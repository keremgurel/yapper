import type { Platform, ScrapedVideo } from "@/lib/inspiration/types";

/** One platform's own-content totals, from a scrape of the creator's feed. */
export interface PlatformViewStats {
  platform: Platform;
  videoCount: number;
  views: number;
  likes: number;
}

/** Total views of the posts published in a given calendar month (UTC). */
export interface MonthViews {
  /** YYYY-MM in UTC, so a bucket key never shifts with the viewer's timezone. */
  month: string;
  views: number;
}

/** The dashboard's cross-platform numbers, rolled up from every connected
 * platform's scrape. */
export interface CrossPlatformViewStats {
  views: number;
  likes: number;
  videoCount: number;
  /** Per platform, biggest by views first. */
  perPlatform: PlatformViewStats[];
  /** Views by publish month, oldest first, summed across platforms. */
  byMonth: MonthViews[];
}

/** One platform's scraped feed (from `scrapeCreator`, pointed at the user's own
 * handle). */
export interface PlatformScrape {
  platform: Platform;
  videos: ScrapedVideo[];
}

/** The UTC YYYY-MM a post belongs to, or null when it has no usable date. UTC so
 * the bucketing is deterministic regardless of where the code runs. */
function monthKey(iso: string | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Roll one platform's scraped feed into its totals. */
export function platformViewStats(scrape: PlatformScrape): PlatformViewStats {
  let views = 0;
  let likes = 0;
  for (const v of scrape.videos) {
    views += v.views;
    likes += v.likes;
  }
  return {
    platform: scrape.platform,
    videoCount: scrape.videos.length,
    views,
    likes,
  };
}

/**
 * Roll every connected platform's scrape into the dashboard's cross-platform
 * numbers: overall totals, a per-platform breakdown (biggest first), and views
 * bucketed by the month each post went up. A post with no usable date still
 * counts toward the totals but is left out of the monthly series, since it has
 * nowhere to sit on the timeline. Pure, so the tiles and the chart agree.
 */
export function crossPlatformViewStats(
  scrapes: PlatformScrape[],
): CrossPlatformViewStats {
  const perPlatform = scrapes
    .map(platformViewStats)
    .sort((a, b) => b.views - a.views);

  const months = new Map<string, number>();
  let views = 0;
  let likes = 0;
  let videoCount = 0;
  for (const scrape of scrapes) {
    for (const v of scrape.videos) {
      views += v.views;
      likes += v.likes;
      videoCount += 1;
      const key = monthKey(v.postedAt);
      if (key) months.set(key, (months.get(key) ?? 0) + v.views);
    }
  }

  const byMonth = [...months.entries()]
    .map(([month, monthViews]) => ({ month, views: monthViews }))
    .sort((a, b) => a.month.localeCompare(b.month));

  return { views, likes, videoCount, perPlatform, byMonth };
}
