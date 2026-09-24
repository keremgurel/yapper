import { sql } from "drizzle-orm";
import { lapsedMediaDeleteAt } from "@/lib/billing/entitlement";
import { getDb } from "./client";
import { releasePostedMedia } from "./posted-media-retention";

interface StoredVideoOwner {
  userId: string;
  subscriptionStatus: string | null;
  currentPeriodEnd: Date | null;
  mediaKeys: string[];
}

/** Accounts that still hold stored videos (recordings or imports). */
async function ownersWithStoredVideos(
  limit: number,
): Promise<StoredVideoOwner[]> {
  const rows = await getDb().execute<{
    user_id: string;
    subscription_status: string | null;
    current_period_end: string | Date | null;
    keys: string[];
  }>(sql`
    select u.id as user_id, u.subscription_status, u.current_period_end,
      array_agg(distinct k.media_key) as keys
    from users u
    join (
      select user_id, media_key from submissions where media_key is not null
      union
      select user_id, media_key from imported_platform_media
    ) k on k.user_id = u.id
    where u.subscription_status is null
      or u.subscription_status not in ('trialing', 'active', 'past_due')
      or u.current_period_end < now() - interval '3 days'
    group by u.id
    limit ${limit}
  `);
  return rows.rows.map((row) => ({
    userId: row.user_id,
    subscriptionStatus: row.subscription_status,
    currentPeriodEnd: row.current_period_end
      ? new Date(row.current_period_end)
      : null,
    mediaKeys: row.keys,
  }));
}

/**
 * Deletes the stored videos of accounts whose access ended more than 30 days
 * ago. Their Brain, ideas, scripts and brand logos stay; only the video files,
 * which are what cost money, go. Resubscribing inside the 30 days loses nothing.
 */
export async function releaseLapsedMediaBatch(
  now: Date = new Date(),
  limit = 200,
): Promise<{ accounts: number; released: number; failed: number }> {
  let accounts = 0;
  let released = 0;
  let failed = 0;
  for (const owner of await ownersWithStoredVideos(limit)) {
    const deleteAt = lapsedMediaDeleteAt(owner, now);
    if (!deleteAt || deleteAt > now) continue;
    accounts += 1;
    for (const mediaKey of owner.mediaKeys) {
      try {
        const outcome = await releasePostedMedia(
          { userId: owner.userId, mediaKey },
          "subscription_lapsed",
        );
        if (outcome === "released") released += 1;
      } catch (error) {
        failed += 1;
        console.error("[retention] could not release lapsed media", error);
      }
    }
  }
  return { accounts, released, failed };
}
