import { and, eq, gt, lt } from "drizzle-orm";
import { getDb } from "./client";
import { scrapeCache } from "./schema";

/**
 * A cached scrape younger than `maxAgeMs`, or null. Never throws: a cache that
 * is down must cost a scrape, not the feature.
 */
export async function readScrapeCache<T>(
  key: string | null,
  maxAgeMs: number,
): Promise<T | null> {
  if (!key) return null;
  try {
    const [row] = await getDb()
      .select({ payload: scrapeCache.payload })
      .from(scrapeCache)
      .where(
        and(
          eq(scrapeCache.key, key),
          gt(scrapeCache.createdAt, new Date(Date.now() - maxAgeMs)),
        ),
      )
      .limit(1);
    return (row?.payload as T | undefined) ?? null;
  } catch (error) {
    console.warn("[scrape-cache] read failed", error);
    return null;
  }
}

/** Store a successful result. Never throws, for the same reason. */
export async function writeScrapeCache(
  key: string | null,
  payload: object,
): Promise<void> {
  if (!key) return;
  try {
    const row = {
      payload: payload as Record<string, unknown>,
      createdAt: new Date(),
    };
    await getDb()
      .insert(scrapeCache)
      .values({ key, ...row })
      .onConflictDoUpdate({ target: scrapeCache.key, set: row });
  } catch (error) {
    console.warn("[scrape-cache] write failed", error);
  }
}

/** Drop rows older than `maxAgeMs`, for the daily maintenance cron. */
export async function pruneScrapeCache(maxAgeMs: number): Promise<void> {
  await getDb()
    .delete(scrapeCache)
    .where(lt(scrapeCache.createdAt, new Date(Date.now() - maxAgeMs)));
}
