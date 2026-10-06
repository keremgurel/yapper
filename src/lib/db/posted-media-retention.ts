import { and, eq, inArray, sql } from "drizzle-orm";
import { getDb, type DbTx } from "./client";
import { waitingPosterMediaQuery } from "./poster-slot";
import { enqueueObjectDeletionWithinTx } from "./r2-lifecycle";
import {
  contentItems,
  importedPlatformMedia,
  submissions,
  users,
} from "./schema";
import {
  lockMediaReferenceWithinTx,
  lockStorageUserWithinTx,
} from "./storage-accounting";

/** A finished post's video is kept this long, for retrying a destination. */
export const POSTED_MEDIA_GRACE_MS = 24 * 60 * 60 * 1_000;
export interface PostedMediaCandidate {
  userId: string;
  mediaKey: string;
}

/**
 * Stored videos whose posting is over: every publish attempt that used the
 * video finished more than a day ago, no scheduled post still
 * needs it, and something still holds it in storage. The creator has the
 * original on their Mac, and YouTube and TikTok cannot hand the file back, so
 * a posted video is not worth paying to store.
 */
export async function findPostedMedia(
  now: Date,
  limit: number,
  db: Pick<DbTx, "execute"> = getDb(),
  candidate?: PostedMediaCandidate,
): Promise<PostedMediaCandidate[]> {
  const grace = new Date(now.getTime() - POSTED_MEDIA_GRACE_MS);
  const rows = await db.execute<{
    user_id: string;
    media_key: string;
  }>(sql`
    select pj.user_id, pj.media_key
    from publish_jobs pj
    where ${candidate ? sql`pj.user_id = ${candidate.userId} and pj.media_key = ${candidate.mediaKey}` : sql`true`}
    group by pj.user_id, pj.media_key
    having max(pj.updated_at) < ${grace}
      and bool_and(pj.status in ('published', 'failed'))
      and bool_or(pj.status = 'published')
      and not exists (
        select 1 from publishing_schedules ps
        where ps.user_id = pj.user_id
          and ps.status in ('scheduled', 'running', 'needs_attention')
          and ps.input->>'mediaKey' = pj.media_key
      )
      and not exists (
        select 1 from content_items ci join submissions s on s.id = ci.submission_id
        where ci.user_id = pj.user_id and s.media_key = pj.media_key and ci.editor_revision is not null
      )
      and (
        exists (select 1 from submissions s where s.user_id = pj.user_id and s.media_key = pj.media_key)
        or exists (select 1 from imported_platform_media i where i.user_id = pj.user_id and i.media_key = pj.media_key)
      )
    limit ${limit}
  `);
  return rows.rows.map((row) => ({
    userId: row.user_id,
    mediaKey: row.media_key,
  }));
}

/** Protected by the same user lock used by publishing/scheduling writers. */
function protectedMediaQuery(
  candidate: PostedMediaCandidate,
  now: Date,
  protectEdit: boolean,
) {
  const { userId, mediaKey } = candidate;
  return sql`
    select 1 where
      exists (select 1 from content_items ci join submissions s on s.id = ci.submission_id
        where ${protectEdit} and ci.user_id = ${userId} and s.media_key = ${mediaKey} and ci.editor_revision is not null)
      or       exists (select 1 from publishing_schedules ps
        where ps.user_id = ${userId} and ps.input->>'mediaKey' = ${mediaKey}
          and ps.status in ('scheduled', 'running', 'needs_attention'))
      or exists (select 1 from publish_jobs pj
        where pj.user_id = ${userId} and pj.media_key = ${mediaKey}
          and (pj.status in ('queued', 'uploading', 'processing')
            or pj.updated_at >= ${new Date(now.getTime() - POSTED_MEDIA_GRACE_MS)}))
      or exists (select 1 from r2_objects r
        where r.user_id = ${userId} and r.media_key = ${mediaKey}
          and (r.state <> 'active' or r.delete_not_before > ${now}))
      or exists (select 1 from submissions s
        where s.user_id = ${userId} and s.media_key = ${mediaKey}
          and s.updated_at > ${new Date(now.getTime() - 10 * 60 * 1_000)})
  `;
}

/** Legacy/raced uploads that exceed the single waiting-video allowance.
 * Deduplicate physical keys before ranking; scheduled/posted media are outside
 * the waiting slot. Training recordings are not Poster uploads. */
export async function findSupersededMedia(
  limit = 500,
  userId?: string,
  db: Pick<DbTx, "execute"> = getDb(),
  mediaKey?: string,
): Promise<PostedMediaCandidate[]> {
  const rows = await db.execute<{ user_id: string; media_key: string }>(sql`
    with waiting as (${waitingPosterMediaQuery(userId)}),
    objects as (
      select user_id, media_key, max(created_at) as created_at
      from waiting group by user_id, media_key
    ), ranked as (
      select *, row_number() over (
        partition by user_id order by created_at desc, media_key desc
      ) as position from objects
    )
    select user_id, media_key from ranked
    where position > 1
      and ${mediaKey ? sql`media_key = ${mediaKey}` : sql`true`}
    union
    select s.user_id, s.media_key from submissions s
    where s.media_key like 'u/%/project-%'
      and ${userId ? sql`s.user_id = ${userId}` : sql`true`}
      and ${mediaKey ? sql`s.media_key = ${mediaKey}` : sql`true`}
      and not exists (select 1 from content_items ci where ci.user_id = s.user_id and ci.submission_id = s.id and ci.editor_revision is not null)
    limit ${limit}
  `);
  return rows.rows.map((row) => ({
    userId: row.user_id,
    mediaKey: row.media_key,
  }));
}

export async function releaseSupersededMediaBatch(
  now: Date = new Date(),
  limit = 500,
  userId?: string,
): Promise<{ released: number; failed: number }> {
  let released = 0;
  let failed = 0;
  for (const candidate of await findSupersededMedia(limit, userId)) {
    try {
      if (
        (await releasePostedMedia(candidate, "superseded", now)) === "released"
      )
        released += 1;
    } catch (error) {
      failed += 1;
      console.error("[retention] could not release superseded media", error);
    }
  }
  return { released, failed };
}

/**
 * Lets go of one posted video: its recording and import rows stop pointing at
 * the file, the idea stops offering it in Poster, the quota gets the bytes
 * back, and the object is queued for deletion. The idea, its script and its
 * transcript stay.
 */
export async function releasePostedMedia(
  candidate: PostedMediaCandidate,
  reason = "posted",
  now: Date = new Date(),
): Promise<"released" | "skipped"> {
  const { userId, mediaKey } = candidate;
  return getDb().transaction(async (tx) => {
    await lockStorageUserWithinTx(tx, userId);
    await lockMediaReferenceWithinTx(tx, userId, mediaKey);

    // Discovery is only a snapshot. Re-check after acquiring the locks so a
    // new schedule, retry, or removal of the newer video cannot cause data loss.
    if (
      (
        await tx.execute(
          protectedMediaQuery(candidate, now, reason !== "subscription_lapsed"),
        )
      ).rows.length
    )
      return "skipped";
    if (
      reason === "posted" &&
      !(await findPostedMedia(now, 1, tx, candidate)).length
    )
      return "skipped";
    if (
      reason === "superseded" &&
      !(await findSupersededMedia(1, userId, tx, mediaKey)).length
    )
      return "skipped";

    const held = await tx
      .select({ id: submissions.id, bytes: submissions.mediaBytes })
      .from(submissions)
      .where(
        and(eq(submissions.userId, userId), eq(submissions.mediaKey, mediaKey)),
      );
    const imports = await tx
      .select({
        id: importedPlatformMedia.id,
        bytes: importedPlatformMedia.mediaBytes,
      })
      .from(importedPlatformMedia)
      .where(
        and(
          eq(importedPlatformMedia.userId, userId),
          eq(importedPlatformMedia.mediaKey, mediaKey),
        ),
      );
    if (held.length === 0 && imports.length === 0) return "skipped";

    // One object is counted once, whichever row carries its size.
    const bytes = Math.max(
      0,
      ...held.map((r) => r.bytes),
      ...imports.map((r) => r.bytes),
    );
    const submissionIds = held.map((row) => row.id);

    if (submissionIds.length > 0) {
      await tx
        .update(submissions)
        .set({ mediaKey: null, mediaBytes: 0, updatedAt: new Date() })
        .where(inArray(submissions.id, submissionIds));
      await tx
        .update(contentItems)
        .set({ submissionId: null, updatedAt: now })
        .where(
          and(
            eq(contentItems.userId, userId),
            inArray(contentItems.submissionId, submissionIds),
          ),
        );
    }
    if (imports.length > 0) {
      await tx.delete(importedPlatformMedia).where(
        inArray(
          importedPlatformMedia.id,
          imports.map((row) => row.id),
        ),
      );
    }
    if (bytes > 0) {
      await tx
        .update(users)
        .set({
          storageBytes: sql`greatest(0, ${users.storageBytes} - ${bytes})`,
        })
        .where(eq(users.id, userId));
    }
    await enqueueObjectDeletionWithinTx(tx, userId, mediaKey, reason);
    return "released";
  });
}

/** One pass for the daily maintenance run. */
export async function releasePostedMediaBatch(
  now: Date = new Date(),
  limit = 500,
): Promise<{ released: number; failed: number }> {
  let released = 0;
  let failed = 0;
  for (const candidate of await findPostedMedia(now, limit)) {
    try {
      if ((await releasePostedMedia(candidate, "posted", now)) === "released")
        released += 1;
    } catch (error) {
      failed += 1;
      console.error("[retention] could not release posted media", error);
    }
  }
  return { released, failed };
}
