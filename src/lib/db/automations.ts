import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, inArray, isNull, lte, or } from "drizzle-orm";
import { getDb } from "./client";
import { lockStorageUserWithinTx } from "./storage-accounting";
import { automationRules, automationRuns, publishingSchedules } from "./schema";
import {
  createPublishingSchedulesWithinTx,
  type PublishingSchedule,
} from "./publishing-schedules";
import { automationCopy } from "@/lib/publish/automation-input";
import type {
  AutomationAccount,
  AutomationSettings,
} from "@/lib/publish/automation-types";

export type AutomationRule = typeof automationRules.$inferSelect;
export type AutomationRun = typeof automationRuns.$inferSelect;
export class AutomationConflict extends Error {}

export async function getAutomation(userId: string): Promise<{
  rule: AutomationRule | null;
  runs: AutomationRun[];
  schedules: PublishingSchedule[];
}> {
  const [rule] = await getDb()
    .select()
    .from(automationRules)
    .where(eq(automationRules.userId, userId));
  const runs = await getDb()
    .select()
    .from(automationRuns)
    .where(eq(automationRuns.userId, userId))
    .orderBy(desc(automationRuns.createdAt))
    .limit(50);
  const schedules = runs.length
    ? await getDb()
        .select()
        .from(publishingSchedules)
        .where(
          and(
            eq(publishingSchedules.userId, userId),
            inArray(
              publishingSchedules.requestKey,
              runs.map((run) => run.id),
            ),
          ),
        )
    : [];
  return { rule: rule ?? null, runs, schedules };
}

export async function saveAutomationRule(
  userId: string,
  input: {
    version: number;
    enabled: boolean;
    settings: AutomationSettings;
    sourceAccountId: string | null;
    sourceLabel: string | null;
    accounts: AutomationAccount[];
  },
  now = new Date(),
) {
  return getDb().transaction(async (tx) => {
    await lockStorageUserWithinTx(tx, userId);
    const [prior] = await tx
      .select()
      .from(automationRules)
      .where(eq(automationRules.userId, userId))
      .for("update");
    if ((prior?.version ?? 0) !== input.version)
      throw new AutomationConflict("automation_changed");
    const restarted =
      input.enabled &&
      (!prior?.enabled || prior.sourceAccountId !== input.sourceAccountId);
    const value = {
      enabled: input.enabled,
      settings: input.settings,
      sourceAccountId: input.enabled
        ? input.sourceAccountId
        : (prior?.sourceAccountId ?? null),
      sourceLabel: input.enabled
        ? input.sourceLabel
        : (prior?.sourceLabel ?? null),
      accounts: input.enabled ? input.accounts : (prior?.accounts ?? []),
      enabledAt: restarted ? now : (prior?.enabledAt ?? null),
      scanCursor: restarted ? null : (prior?.scanCursor ?? null),
      version: input.version + 1,
      error: null,
      leaseToken: null,
      leaseExpiresAt: null,
      nextCheckAt: now,
      updatedAt: now,
    };
    const [row] = prior
      ? await tx
          .update(automationRules)
          .set(value)
          .where(eq(automationRules.id, prior.id))
          .returning()
      : await tx
          .insert(automationRules)
          .values({ ...value, userId })
          .returning();
    if (!input.enabled || restarted) {
      // Importing can be cancelled: its eventual enqueue must acquire this
      // rule's lock again. Already claimed platform sends are allowed to finish.
      await tx
        .update(automationRuns)
        .set({
          status: "cancelled",
          error: null,
          leaseToken: null,
          leaseExpiresAt: null,
          updatedAt: now,
        })
        .where(
          and(
            eq(automationRuns.ruleId, row.id),
            inArray(automationRuns.status, ["pending", "importing", "failed"]),
          ),
        );
      await tx
        .update(publishingSchedules)
        .set({ status: "cancelled", error: null, updatedAt: now })
        .where(
          and(
            eq(publishingSchedules.userId, userId),
            inArray(publishingSchedules.status, ["scheduled", "failed"]),
            inArray(
              publishingSchedules.requestKey,
              tx
                .select({ id: automationRuns.id })
                .from(automationRuns)
                .where(eq(automationRuns.ruleId, row.id)),
            ),
          ),
        );
    }
    return row;
  });
}

export async function claimAutomationRules(limit = 3, now = new Date()) {
  return getDb().transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(automationRules)
      .where(
        and(
          eq(automationRules.enabled, true),
          lte(automationRules.nextCheckAt, now),
          or(
            isNull(automationRules.leaseToken),
            lte(automationRules.leaseExpiresAt, now),
          ),
        ),
      )
      .orderBy(asc(automationRules.nextCheckAt))
      .limit(limit)
      .for("update", { skipLocked: true });
    const claimed: AutomationRule[] = [];
    for (const row of rows) {
      const [saved] = await tx
        .update(automationRules)
        .set({
          leaseToken: randomUUID(),
          leaseExpiresAt: new Date(now.getTime() + 6 * 60_000),
        })
        .where(eq(automationRules.id, row.id))
        .returning();
      claimed.push(saved);
    }
    return claimed;
  });
}

export interface DiscoveredInstagramPost {
  id: string;
  caption: string;
  url: string;
  publishedAt: string;
}
export async function finishAutomationScan(
  rule: AutomationRule,
  result: {
    posts: DiscoveredInstagramPost[];
    cursor: string | null;
    error?: string;
  },
  now = new Date(),
) {
  if (!rule.leaseToken) throw new AutomationConflict("automation_not_claimed");
  return getDb().transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(automationRules)
      .where(
        and(
          eq(automationRules.id, rule.id),
          eq(automationRules.enabled, true),
          eq(automationRules.version, rule.version),
          eq(automationRules.leaseToken, rule.leaseToken!),
        ),
      )
      .for("update");
    if (!current || !current.enabledAt || !current.sourceAccountId) return 0;
    const posts = result.posts.filter(
      (post) =>
        Number.isFinite(Date.parse(post.publishedAt)) &&
        Date.parse(post.publishedAt) >= current.enabledAt!.getTime(),
    );
    let inserted = 0;
    for (const post of posts) {
      const rows = await tx
        .insert(automationRuns)
        .values({
          userId: current.userId,
          ruleId: current.id,
          sourceAccountId: current.sourceAccountId,
          sourcePostId: post.id,
          sourceUrl: post.url,
          caption: post.caption,
          title: automationCopy(post.caption, current.settings).title,
          settings: current.settings,
          accounts: current.accounts,
        })
        .onConflictDoNothing({
          target: [automationRuns.ruleId, automationRuns.sourcePostId],
        })
        .returning({ id: automationRuns.id });
      inserted += rows.length;
    }
    await tx
      .update(automationRules)
      .set({
        scanCursor: result.cursor,
        error: result.error?.slice(0, 300) ?? null,
        lastCheckedAt: result.error ? current.lastCheckedAt : now,
        nextCheckAt: new Date(now.getTime() + 5 * 60_000),
        leaseToken: null,
        leaseExpiresAt: null,
        updatedAt: now,
      })
      .where(eq(automationRules.id, current.id));
    return inserted;
  });
}

export async function claimAutomationRuns(limit = 3, now = new Date()) {
  return getDb().transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(automationRuns)
      .where(
        and(
          inArray(
            automationRuns.ruleId,
            tx
              .select({ id: automationRules.id })
              .from(automationRules)
              .where(eq(automationRules.enabled, true)),
          ),
          or(
            eq(automationRuns.status, "pending"),
            and(
              eq(automationRuns.status, "importing"),
              lte(automationRuns.leaseExpiresAt, now),
            ),
          ),
        ),
      )
      .orderBy(asc(automationRuns.createdAt))
      .limit(limit)
      .for("update", { skipLocked: true });
    const claimed: AutomationRun[] = [];
    for (const row of rows) {
      const [saved] = await tx
        .update(automationRuns)
        .set({
          status: "importing",
          leaseToken: randomUUID(),
          leaseExpiresAt: new Date(now.getTime() + 6 * 60_000),
          updatedAt: now,
        })
        .where(eq(automationRuns.id, row.id))
        .returning();
      claimed.push(saved);
    }
    return claimed;
  });
}

/** Import completion and destination enqueue commit together. Disable locks
 * the same rule first, so an in-flight download cannot re-arm a paused rule. */
export async function enqueueAutomationRun(
  run: AutomationRun,
  mediaKey: string,
) {
  if (!run.leaseToken) throw new AutomationConflict("automation_not_claimed");
  return getDb().transaction(async (tx) => {
    await lockStorageUserWithinTx(tx, run.userId);
    const [rule] = await tx
      .select()
      .from(automationRules)
      .where(eq(automationRules.id, run.ruleId))
      .for("update");
    const [current] = await tx
      .select()
      .from(automationRuns)
      .where(
        and(
          eq(automationRuns.id, run.id),
          eq(automationRuns.status, "importing"),
          eq(automationRuns.leaseToken, run.leaseToken!),
        ),
      )
      .for("update");
    if (!rule?.enabled || !current) return false;
    if (!current.accounts.length)
      throw new AutomationConflict("destination_not_connected");
    const copy = automationCopy(current.caption, current.settings);
    await createPublishingSchedulesWithinTx(
      tx,
      current.userId,
      current.id,
      "automation-run-v1",
      current.accounts.map((account) => ({
        platform: account.platform,
        externalAccountId: account.id,
        accountLabel: account.label,
        title: copy.title,
        input: {
          mediaKey,
          ...(account.platform === "youtube"
            ? { ...copy, privacyStatus: "public" as const }
            : {}),
        },
        scheduledFor: new Date(),
        timezone: "UTC",
      })),
    );
    await tx
      .update(automationRuns)
      .set({
        status: "queued",
        error: null,
        leaseToken: null,
        leaseExpiresAt: null,
        updatedAt: new Date(),
      })
      .where(eq(automationRuns.id, current.id));
    return true;
  });
}

export async function failAutomationRun(run: AutomationRun, error: string) {
  if (!run.leaseToken) return;
  await getDb()
    .update(automationRuns)
    .set({
      status: "failed",
      error: error.slice(0, 300),
      leaseToken: null,
      leaseExpiresAt: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(automationRuns.id, run.id),
        eq(automationRuns.leaseToken, run.leaseToken),
        eq(automationRuns.status, "importing"),
      ),
    );
}

export async function retryAutomationRun(userId: string, id: string) {
  return getDb().transaction(async (tx) => {
    const [rule] = await tx
      .select()
      .from(automationRules)
      .where(eq(automationRules.userId, userId))
      .for("update");
    if (!rule?.enabled) throw new AutomationConflict("automation_paused");
    const [row] = await tx
      .update(automationRuns)
      .set({ status: "pending", error: null, updatedAt: new Date() })
      .where(
        and(
          eq(automationRuns.userId, userId),
          eq(automationRuns.id, id),
          eq(automationRuns.status, "failed"),
        ),
      )
      .returning();
    if (!row) throw new AutomationConflict("automation_not_retryable");
    return row;
  });
}
