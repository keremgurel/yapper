import type { PublishPlatform } from "@/lib/db/schema";
import type { RankedVideo } from "./rank-videos";
import { typicalViews } from "./channel-stats";

const DAY = 86_400_000;
export interface VideoGroup {
  id: string;
  primary: RankedVideo;
  posts: RankedVideo[];
  views: number;
  publishedAt: string;
}

function titleKey(video: RankedVideo): string {
  return (video.title || video.caption || "")
    .split("\n")[0]
    .replace(/https?:\/\/\S+|#[\p{L}\p{N}_]+/gu, "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** Conservative metadata matching, not visual recognition. Never join two
 * posts on one platform, short generic titles, or different episodes. A saved
 * source is authoritative; matching captions need a seven-day publish window. */
export function sameVideo(a: RankedVideo, b: RankedVideo): boolean {
  if (a.platform === b.platform) return false;
  if (a.mediaKey && b.mediaKey) return a.mediaKey === b.mediaKey;
  const gap = Math.abs(Date.parse(a.publishedAt) - Date.parse(b.publishedAt));
  if (!Number.isFinite(gap) || gap > 7 * DAY) return false;
  const left = titleKey(a);
  const right = titleKey(b);
  if (Math.min(left.length, right.length) < 16) return false;
  if (left === right) return true;
  const [short, long] =
    left.length < right.length ? [left, right] : [right, left];
  return short.length >= 48 && long.startsWith(`${short} `);
}

export function groupVideos(videos: RankedVideo[]): VideoGroup[] {
  const groups: VideoGroup[] = [];
  const seen = new Set<string>();
  for (const video of [...videos].sort(
    (a, b) =>
      b.viewCount - a.viewCount ||
      `${a.platform}:${a.id}`.localeCompare(`${b.platform}:${b.id}`),
  )) {
    const key = `${video.platform}:${video.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const group = groups.find(
      (candidate) =>
        !candidate.posts.some((post) => post.platform === video.platform) &&
        candidate.posts.some((post) => sameVideo(post, video)),
    );
    if (group) {
      group.posts.push(video);
      group.views += video.viewCount || 0;
      if (video.publishedAt > group.publishedAt)
        group.publishedAt = video.publishedAt;
      group.id = group.posts
        .map((post) => `${post.platform}:${post.id}`)
        .sort()
        .join("|");
    } else {
      groups.push({
        id: key,
        primary: video,
        posts: [video],
        views: video.viewCount || 0,
        publishedAt: video.publishedAt,
      });
    }
  }
  return groups.sort((a, b) => b.views - a.views || a.id.localeCompare(b.id));
}

export interface Opportunity {
  kind: "follow-up" | "share" | "revisit";
  group: VideoGroup;
  comparison?: { platform: PublishPlatform; times: number };
  missing?: PublishPlatform[];
}

/** Lifetime totals are not growth. Compare only with the same channel, require
 * five other mature posts, and never call a fresh upload an underperformer. */
export function contentOpportunities(
  groups: VideoGroup[],
  videos: RankedVideo[],
  connected: PublishPlatform[],
  now: number,
  rotation = 0,
): Opportunity[] {
  const age = (at: string) => (now - Date.parse(at)) / DAY;
  const comparison = (group: VideoGroup) =>
    group.posts
      .flatMap((post) => {
        const baseline = videos.filter(
          (other) =>
            other.platform === post.platform &&
            other.id !== post.id &&
            age(other.publishedAt) >= 7 &&
            age(other.publishedAt) <= 180,
        );
        const typical = typicalViews(baseline);
        return baseline.length >= 5 &&
          typical > 0 &&
          post.viewCount >= typical * 1.5
          ? [{ platform: post.platform, times: post.viewCount / typical }]
          : [];
      })
      .sort((a, b) => b.times - a.times)[0];
  const used = new Set<string>();
  const result: Opportunity[] = [];
  const choose = (pool: Opportunity[]) => {
    const available = pool.filter((item) => !used.has(item.group.id));
    if (!available.length) return;
    const index =
      (((Math.floor(now / DAY) + rotation) % available.length) +
        available.length) %
      available.length;
    const chosen = available[index];
    used.add(chosen.group.id);
    result.push(chosen);
  };
  choose(
    groups.flatMap((group) => {
      const match = comparison(group);
      return age(group.publishedAt) >= 2 &&
        age(group.publishedAt) <= 30 &&
        match
        ? [{ kind: "follow-up" as const, group, comparison: match }]
        : [];
    }),
  );
  choose(
    groups.flatMap((group) => {
      const missing = connected.filter(
        (platform) => !group.posts.some((post) => post.platform === platform),
      );
      return age(group.publishedAt) >= 2 &&
        age(group.publishedAt) <= 30 &&
        missing.length
        ? [{ kind: "share" as const, group, missing }]
        : [];
    }),
  );
  choose(
    groups.flatMap((group) => {
      const match = comparison(group);
      return age(group.publishedAt) > 30 &&
        age(group.publishedAt) <= 180 &&
        match
        ? [{ kind: "revisit" as const, group, comparison: match }]
        : [];
    }),
  );
  return result;
}
