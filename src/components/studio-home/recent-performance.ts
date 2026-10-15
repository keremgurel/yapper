import type { PublishPlatform } from "@/lib/db/schema";
import type { RankedVideo } from "./rank-videos";
import { groupVideos, type VideoGroup } from "./group-videos";
import { typicalViews } from "./channel-stats";
const DAY = 86_400_000;
export interface RecentPerformance {
  groups: VideoGroup[];
  totalViews: number;
  postCount: number;
  typical: number;
  thisWeek: number;
  channels: {
    platform: PublishPlatform;
    views: number;
    posts: number;
    typical: number;
  }[];
}
/** Current lifetime totals for posts published within the rolling window.
 * Never describes these as views earned within that window. Filter before
 * grouping so a recent cross-post cannot pull an old copy's views into it. */
export function recentPerformance(
  videos: RankedVideo[],
  connected: PublishPlatform[],
  now: number,
): RecentPerformance {
  const recent = videos.filter((video) => {
    const date = Date.parse(video.publishedAt);
    return date >= now - 30 * DAY && date <= now;
  });
  const groups = groupVideos(recent);
  const posts = groups.flatMap((group) => group.posts);
  const combined = groups.map((group) => ({
    ...group.primary,
    viewCount: group.views,
  }));
  const platforms = [
    ...new Set([...connected, ...posts.map((post) => post.platform)]),
  ];
  return {
    groups,
    totalViews: groups.reduce((sum, group) => sum + group.views, 0),
    postCount: posts.length,
    typical: typicalViews(combined),
    thisWeek: groups.filter(
      (group) => Date.parse(group.publishedAt) >= now - 7 * DAY,
    ).length,
    channels: platforms
      .map((platform) => {
        const channel = posts.filter((post) => post.platform === platform);
        return {
          platform,
          views: channel.reduce((sum, post) => sum + (post.viewCount || 0), 0),
          posts: channel.length,
          typical: typicalViews(channel),
        };
      })
      .sort((a, b) => b.views - a.views),
  };
}
