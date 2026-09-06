import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, inArray, lte, or, sql } from "drizzle-orm";
import { getDb, type DbTx } from "./client";
import { lockStorageUserWithinTx } from "./storage-accounting";
import { publishingSchedules, publishJobs, r2Objects } from "./schema";
import type { ScheduleStatus } from "@/lib/publish/schedule-types";

export type PublishingSchedule = typeof publishingSchedules.$inferSelect;
export type NewPublishingSchedule = Omit<
  typeof publishingSchedules.$inferInsert,
  "id" | "userId" | "requestKey" | "requestHash" | "entryIndex"
>;

export class ScheduleConflict extends Error {}

export async function listPublishingSchedules(userId: string) {
  return getDb()
    .select()
    .from(publishingSchedules)
    .where(eq(publishingSchedules.userId, userId))
    .orderBy(
      sql`case when ${publishingSchedules.status} in ('scheduled', 'running', 'needs_attention', 'failed') then 0 else 1 end`,
      desc(publishingSchedules.scheduledFor),
    )
    .limit(100);
}

export async function findScheduleRequest(
  userId: string,
  requestKey: string,
  hash: string,
) {
  const rows = await getDb()
    .select()
    .from(publishingSchedules)
    .where(
      and(
        eq(publishingSchedules.userId, userId),
        eq(publishingSchedules.requestKey, requestKey),
      ),
    )
    .orderBy(asc(publishingSchedules.entryIndex));
  if (rows.some((row) => row.requestHash !== hash))
    throw new ScheduleConflict("schedule_request_changed");
  return rows;
}

/** A delayed provider response may finish after a replacement worker observed
 * its pending claim. Recover that final result without sending anything again. */
export async function reconcileScheduleOutcomes() {
  return getDb()
    .update(publishingSchedules)
    .set({
      status: sql`case when ${publishJobs.status} = 'failed' then 'failed' when ${publishingSchedules.platform} = 'tiktok' then 'draft' else 'published' end`,
      publishJobId: publishJobs.id,
      externalUrl: publishJobs.externalUrl,
      error: publishJobs.error,
      updatedAt: new Date(),
    })
    .from(publishJobs)
    .where(
      and(
        inArray(publishingSchedules.status, ["needs_attention", "failed"]),
        eq(publishJobs.userId, publishingSchedules.userId),
        eq(publishJobs.platform, publishingSchedules.platform),
        eq(
          publishJobs.idempotencyKey,
          sql`'schedule:' || ${publishingSchedules.id}::text || ':' || ${publishingSchedules.attempt}::text`,
        ),
        inArray(publishJobs.status, ["published", "failed"]),
      ),
    )
    .returning({ id: publishingSchedules.id });
}

/** Save the entire reviewed selection once, or replay its original result. */
export async function createPublishingSchedules(
  userId: string,
  requestKey: string,
  requestHash: string,
  entries: NewPublishingSchedule[],
) {
  return getDb().transaction((tx) =>
    createPublishingSchedulesWithinTx(
      tx,
      userId,
      requestKey,
      requestHash,
      entries,
    ),
  );
}

export async function createPublishingSchedulesWithinTx(
  tx: DbTx,
  userId: string,
  requestKey: string,
  requestHash: string,
  entries: NewPublishingSchedule[],
) {
  await lockStorageUserWithinTx(tx, userId);
  const existing = await tx
    .select()
    .from(publishingSchedules)
    .where(
      and(
        eq(publishingSchedules.userId, userId),
        eq(publishingSchedules.requestKey, requestKey),
      ),
    )
    .orderBy(asc(publishingSchedules.entryIndex));
  if (existing.length) {
    if (existing.some((entry) => entry.requestHash !== requestHash))
      throw new ScheduleConflict("schedule_request_changed");
    return existing;
  }
  // Deletion uses this same user lock. A source cannot disappear between
  // validation and the durable schedule being created.
  const keys = [...new Set(entries.map((entry) => entry.input.mediaKey))];
  const media = await tx
    .select({ key: r2Objects.mediaKey })
    .from(r2Objects)
    .where(
      and(
        eq(r2Objects.userId, userId),
        eq(r2Objects.state, "active"),
        inArray(r2Objects.mediaKey, keys),
      ),
    );
  if (media.length !== keys.length)
    throw new ScheduleConflict("media_unavailable");
  return tx
    .insert(publishingSchedules)
    .values(
      entries.map((entry, entryIndex) => ({
        ...entry,
        userId,
        requestKey,
        requestHash,
        entryIndex,
      })),
    )
    .returning();
}

export function scheduleAttemptKey(
  row: Pick<PublishingSchedule, "id" | "attempt">,
) {
  return `schedule:${row.id}:${row.attempt}`;
}

/** Each invocation owns a small set of rows. Expired leases reuse the exact
 * publish key; the platform publisher reconciles/replays instead of reposting. */
export async function claimDueSchedules(limit = 3, now = new Date()) {
  return getDb().transaction(async (tx) => {
    const due = await tx
      .select()
      .from(publishingSchedules)
      .where(
        or(
          and(
            eq(publishingSchedules.status, "scheduled"),
            lte(publishingSchedules.scheduledFor, now),
          ),
          and(
            eq(publishingSchedules.status, "running"),
            lte(publishingSchedules.leaseExpiresAt, now),
          ),
        ),
      )
      .orderBy(asc(publishingSchedules.scheduledFor))
      .limit(limit)
      .for("update", { skipLocked: true });
    const claimed: PublishingSchedule[] = [];
    for (const row of due) {
      const [saved] = await tx
        .update(publishingSchedules)
        .set({
          status: "running",
          leaseToken: randomUUID(),
          leaseExpiresAt: new Date(now.getTime() + 6 * 60_000),
          updatedAt: now,
        })
        .where(eq(publishingSchedules.id, row.id))
        .returning();
      claimed.push(saved);
    }
    return claimed;
  });
}

export async function settlePublishingSchedule(
  row: PublishingSchedule,
  outcome: {
    status: Extract<
      ScheduleStatus,
      "published" | "draft" | "failed" | "needs_attention"
    >;
    publishJobId?: string;
    externalUrl?: string;
    error?: string;
  },
) {
  if (!row.leaseToken) throw new ScheduleConflict("schedule_not_claimed");
  await getDb()
    .update(publishingSchedules)
    .set({
      status: outcome.status,
      publishJobId: outcome.publishJobId ?? null,
      externalUrl: outcome.externalUrl ?? null,
      error: outcome.error?.slice(0, 500) ?? null,
      leaseToken: null,
      leaseExpiresAt: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(publishingSchedules.id, row.id),
        eq(publishingSchedules.leaseToken, row.leaseToken),
      ),
    );
}

/** No cancellation can race a claimed worker. A new attempt is allowed only
 * after a provably failed platform operation, never after an unknown outcome. */
export async function changePublishingSchedule(
  userId: string,
  id: string,
  action: "cancel" | "reschedule" | "retry",
  date?: Date,
) {
  return getDb().transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(publishingSchedules)
      .where(
        and(
          eq(publishingSchedules.userId, userId),
          eq(publishingSchedules.id, id),
        ),
      )
      .for("update")
      .limit(1);
    if (!row) return null;
    let attempt = row.attempt;
    if (action === "retry") {
      if (row.status !== "failed")
        throw new ScheduleConflict("schedule_not_retryable");
      const [job] = await tx
        .select({ status: publishJobs.status })
        .from(publishJobs)
        .where(
          and(
            eq(publishJobs.userId, userId),
            eq(publishJobs.platform, row.platform),
            eq(publishJobs.idempotencyKey, scheduleAttemptKey(row)),
          ),
        )
        .limit(1);
      if (job && job.status !== "failed")
        throw new ScheduleConflict("publish_state_pending");
      if (job) attempt++;
    } else if (
      !(
        (action === "cancel" && row.status === "failed") ||
        row.status === "scheduled"
      )
    ) {
      throw new ScheduleConflict("schedule_already_started");
    }
    if (action !== "cancel" && date && row.input.thumbnailKey) {
      const until = new Date(date.getTime() + 24 * 60 * 60_000);
      const protectedRows = await tx
        .update(r2Objects)
        .set({
          deleteNotBefore: sql`greatest(coalesce(${r2Objects.deleteNotBefore}, ${until}), ${until})`,
          nextAttemptAt: sql`greatest(coalesce(${r2Objects.nextAttemptAt}, ${until}), ${until})`,
          uploadExpiresAt: sql`case when ${r2Objects.state} = 'pending_upload' then greatest(coalesce(${r2Objects.uploadExpiresAt}, ${until}), ${until}) else ${r2Objects.uploadExpiresAt} end`,
        })
        .where(
          and(
            eq(r2Objects.userId, userId),
            eq(r2Objects.mediaKey, row.input.thumbnailKey),
            eq(r2Objects.purpose, "thumbnail"),
            inArray(r2Objects.state, ["active", "pending_upload"]),
          ),
        )
        .returning({ key: r2Objects.mediaKey });
      if (!protectedRows.length)
        throw new ScheduleConflict("thumbnail_unavailable");
    }
    const [saved] = await tx
      .update(publishingSchedules)
      .set({
        status: action === "cancel" ? "cancelled" : "scheduled",
        scheduledFor: date ?? row.scheduledFor,
        attempt,
        error: null,
        leaseToken: null,
        leaseExpiresAt: null,
        updatedAt: new Date(),
      })
      .where(eq(publishingSchedules.id, id))
      .returning();
    return saved;
  });
}
