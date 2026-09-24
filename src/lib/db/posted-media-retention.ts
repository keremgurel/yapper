import { and, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "./client";
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
/** A post still "in progress" after this long (a TikTok draft nobody finished)
 * no longer holds its video. */
export const STALLED_PUBLISH_MS = 3 * 24 * 60 * 60 * 1_000;

export interface PostedMediaCandidate {
  userId: string;
  mediaKey: string;
}

/**
 * Stored videos whose posting is over: every publish attempt that used the
 * video finished (or stalled) more than a day ago, no scheduled post still
 * needs it, and something still holds it in storage. The creator has the
 * original on their Mac, and YouTube and TikTok cannot hand the file back, so
 * a posted video is not worth paying to store.
 */
export async function findPostedMedia(
  now: Date,
  limit: number,
): Promise<PostedMediaCandidate[]> {
  const grace = new Date(now.getTime() - POSTED_MEDIA_GRACE_MS);
  const stalled = new Date(now.getTime() - STALLED_PUBLISH_MS);
  const rows = await getDb().execute<{
    user_id: string;
    media_key: string;
  }>(sql`
    select pj.user_id, pj.media_key
    from publish_jobs pj
    group by pj.user_id, pj.media_key
    having max(pj.updated_at) < ${grace}
      and bool_and(pj.status in ('published', 'failed') or pj.updated_at < ${stalled})
      and bool_or(pj.status = 'published')
      and not exists (
        select 1 from publishing_schedules ps
        where ps.user_id = pj.user_id
          and ps.status in ('scheduled', 'running', 'needs_attention')
          and ps.input->>'mediaKey' = pj.media_key
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

/**
 * Lets go of one posted video: its recording and import rows stop pointing at
 * the file, the idea stops offering it in Poster, the quota gets the bytes
 * back, and the object is queued for deletion. The idea, its script and its
 * transcript stay.
 */
export async function releasePostedMedia(
  candidate: PostedMediaCandidate,
  reason = "posted",
): Promise<"released" | "skipped"> {
  const { userId, mediaKey } = candidate;
  return getDb().transaction(async (tx) => {
    await lockStorageUserWithinTx(tx, userId);
    await lockMediaReferenceWithinTx(tx, userId, mediaKey);

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
        .set({ submissionId: null, updatedAt: new Date() })
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
      if ((await releasePostedMedia(candidate)) === "released") released += 1;
    } catch (error) {
      failed += 1;
      console.error("[retention] could not release posted media", error);
    }
  }
  return { released, failed };
}
