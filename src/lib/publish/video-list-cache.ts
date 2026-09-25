import { videoListStamp } from "@/lib/db/publish";
import type { PublishPlatform } from "@/lib/db/schema";

/**
 * A short per-instance cache for the connected platforms' own video lists.
 *
 * Each list costs one to fifty provider calls (Instagram asks for insights per
 * video), which is most of a Poster or Home load, and tab switches ask for the
 * same list again seconds later. Entries are keyed by a stamp that changes when
 * the account is reconnected or any Yapper publish job for that platform moves,
 * so a post made through Yapper shows up on the next read on every instance.
 * Posts made directly on the platform appear within `TTL_MS`, or at once when
 * the client asks for `?fresh=1`.
 *
 * Concurrent reads of the same list share one provider round trip. Failures
 * are never cached.
 */

const TTL_MS = 60_000;
const MAX_ENTRIES = 500;

interface Entry {
  stamp: string;
  expiresAt: number;
  videos: Promise<unknown[]>;
}

const cache = new Map<string, Entry>();

function store(key: string, entry: Entry): void {
  cache.delete(key);
  cache.set(key, entry);
  while (cache.size > MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

/** Whether the request asked to skip the cache (a manual refresh). */
export function wantsFreshList(req: Request): boolean {
  return new URL(req.url).searchParams.get("fresh") === "1";
}

/**
 * The platform's video list for this user, from cache when the stamp still
 * matches and the entry is younger than `TTL_MS`, otherwise from `load`.
 */
export async function cachedVideoList<T>(
  userId: string,
  platform: PublishPlatform,
  load: () => Promise<T[]>,
  options: { fresh?: boolean } = {},
): Promise<T[]> {
  const key = `${userId}:${platform}`;
  const stamp = await videoListStamp(userId, platform);
  const hit = cache.get(key);
  if (
    !options.fresh &&
    hit &&
    hit.stamp === stamp &&
    hit.expiresAt > Date.now()
  ) {
    return hit.videos as Promise<T[]>;
  }

  const videos = load();
  const entry: Entry = { stamp, expiresAt: Date.now() + TTL_MS, videos };
  store(key, entry);
  videos.catch(() => {
    if (cache.get(key) === entry) cache.delete(key);
  });
  return videos;
}

/** Drop every cached list. For tests. */
export function clearVideoListCache(): void {
  cache.clear();
}
