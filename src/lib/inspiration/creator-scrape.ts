import type { InspirationItem, ScrapedVideo } from "./types";

/** The creator-scrape endpoint's body. It soft-fails with HTTP 200 and an
 * `error` note so saving a creator never hard-fails, so the note is the only
 * signal that the feed is missing rather than genuinely empty. */
export interface CreatorScrapeResponse {
  name?: string;
  avatar?: string;
  videos?: ScrapedVideo[];
  scrapedAt?: number;
  error?: string;
}

/**
 * Whether a scrape response should be treated as a failure. True when the
 * request errored OR the route soft-failed with an `error` note. A failure must
 * not be recorded as an empty successful feed: that would stamp `scrapedAt` and
 * leave the creator stuck showing "0 videos" with no retry.
 */
export function isScrapeFailure(
  ok: boolean,
  data: CreatorScrapeResponse,
): boolean {
  return !ok || Boolean(data.error);
}

/**
 * The item patch for a SUCCESSFUL scrape: the ranked feed, the scrape time, and
 * a one-time backfill of the avatar and display name for a creator that still
 * has none (the avatar only when there is no thumbnail yet, the name only when
 * the title is still the raw @handle).
 */
export function creatorScrapePatch(
  data: CreatorScrapeResponse,
  item: Pick<InspirationItem, "thumbnail" | "title">,
  now: number,
): Partial<InspirationItem> {
  return {
    videos: data.videos ?? [],
    scrapedAt: data.scrapedAt ?? now,
    ...(data.avatar && !item.thumbnail ? { thumbnail: data.avatar } : {}),
    ...(data.name && item.title.startsWith("@") ? { title: data.name } : {}),
  };
}
