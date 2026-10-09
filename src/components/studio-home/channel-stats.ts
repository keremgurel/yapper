import type { PublishPlatform } from "@/lib/db/schema";
import type { RankedVideo } from "@/components/studio-home/rank-videos";

const DAY = 86_400_000;
const WEEK = 7 * DAY;

/** Posts published at or after `from` and before `to`. */
function publishedBetween(videos: RankedVideo[], from: number, to: number) {
  return videos.filter((video) => {
    const at = Date.parse(video.publishedAt);
    return at >= from && at < to;
  });
}

function sumViews(videos: RankedVideo[]): number {
  return videos.reduce((sum, video) => sum + (video.viewCount || 0), 0);
}

/** The middle post's views: what a normal post does, which one viral hit
 * cannot drag up the way it drags an average. */
export function typicalViews(videos: RankedVideo[]): number {
  if (!videos.length) return 0;
  const sorted = videos
    .map((video) => video.viewCount || 0)
    .sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

/** How a post did against the creator's typical post, or null when there is
 * no typical post to compare with. */
export function versusUsual(views: number, typical: number): number | null {
  return typical > 0 ? views / typical : null;
}

/** Posts per rolling week, oldest first; the last entry is the past 7 days. */
export function weeklyPosts(
  videos: RankedVideo[],
  now: number,
  weeks = 12,
): number[] {
  return Array.from({ length: weeks }, (_, index) => {
    const end = now - (weeks - 1 - index) * WEEK;
    return publishedBetween(videos, end - WEEK, end).length;
  });
}

export interface ChannelStats {
  totalViews: number;
  postCount: number;
  typical: number;
  /** Views on posts published in the last 30 days. */
  recentViews: number;
  /** Change against posts from the 30 days before, or null with nothing to
   * compare against. Views are lifetime counts, so this compares batches of
   * posts, not daily growth. */
  recentChange: number | null;
  postsThisWeek: number;
  /** Rounded average of the eleven weeks before this one. */
  usualPerWeek: number;
  /** Each platform's share of all views, largest first. */
  platforms: { platform: PublishPlatform; views: number }[];
}

export function channelStats(videos: RankedVideo[], now: number): ChannelStats {
  const recent = sumViews(publishedBetween(videos, now - 30 * DAY, now + 1));
  const previous = sumViews(
    publishedBetween(videos, now - 60 * DAY, now - 30 * DAY),
  );
  const weeks = weeklyPosts(videos, now);
  const earlier = weeks.slice(0, -1);
  const byPlatform = new Map<PublishPlatform, number>();
  for (const video of videos)
    byPlatform.set(
      video.platform,
      (byPlatform.get(video.platform) ?? 0) + (video.viewCount || 0),
    );

  return {
    totalViews: sumViews(videos),
    postCount: videos.length,
    typical: typicalViews(videos),
    recentViews: recent,
    recentChange: previous > 0 ? recent / previous - 1 : null,
    postsThisWeek: weeks.at(-1) ?? 0,
    usualPerWeek: Math.round(
      earlier.reduce((sum, count) => sum + count, 0) / earlier.length,
    ),
    platforms: [...byPlatform]
      .map(([platform, views]) => ({ platform, views }))
      .filter((entry) => entry.views > 0)
      .sort((a, b) => b.views - a.views),
  };
}
