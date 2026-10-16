import type { RankedVideo } from "./rank-videos";

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
        !candidate.posts.some(
          (post) =>
            post.mediaKey && video.mediaKey && post.mediaKey !== video.mediaKey,
        ) &&
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
