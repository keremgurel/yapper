import type { PublishPlatform } from "@/lib/db/schema";
import { dayKey } from "@/lib/content/calendar";

/** One already-published post, as the calendar needs it. */
export interface PostedVideo {
  platform: PublishPlatform;
  id: string;
  title: string;
  thumbnail: string | null;
  viewCount: number;
  publishedAt: string;
  url: string;
}

/** A post as it went out on one day: a single video, or the same video
 * cross-posted to several platforms, which reads as one thing on a calendar. */
export interface PostedGroup {
  key: string;
  title: string;
  thumbnail: string | null;
  views: number;
  publishedAt: string;
  /** Each platform's copy, most viewed first. */
  posts: PostedVideo[];
}

/** Titles match across platforms when they agree on their first words.
 * Captions get hashtags and line breaks appended per platform, so the head of
 * the text is the part that survives a cross-post. */
function titleKey(title: string): string {
  return title
    .toLowerCase()
    .replace(/#\S+/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .slice(0, 40);
}

/**
 * Past posts bucketed by the local day they went out, with same-day
 * cross-posts merged into one group. Future-dated rows (a scheduled YouTube
 * premiere) are left out: the calendar already shows what is planned.
 * Each day's groups are ordered by time.
 */
export function bucketPostedByDay(
  videos: PostedVideo[],
  now: number,
): Map<string, PostedGroup[]> {
  const days = new Map<string, Map<string, PostedGroup>>();
  for (const video of videos) {
    const at = Date.parse(video.publishedAt);
    if (!Number.isFinite(at) || at > now) continue;
    const day = dayKey(new Date(at));
    const groups = days.get(day) ?? new Map<string, PostedGroup>();
    days.set(day, groups);
    // Untitled posts never merge: an empty key would glue strangers together.
    const key = titleKey(video.title) || `${video.platform}:${video.id}`;
    const group = groups.get(key);
    if (group && !group.posts.some((p) => p.platform === video.platform)) {
      group.posts.push(video);
      group.views += video.viewCount || 0;
      group.thumbnail ??= video.thumbnail;
      if (video.publishedAt < group.publishedAt)
        group.publishedAt = video.publishedAt;
    } else {
      const fresh: PostedGroup = {
        key: group ? `${key}:${video.platform}:${video.id}` : key,
        title: video.title.trim(),
        thumbnail: video.thumbnail,
        views: video.viewCount || 0,
        publishedAt: video.publishedAt,
        posts: [video],
      };
      groups.set(fresh.key, fresh);
    }
  }

  const out = new Map<string, PostedGroup[]>();
  for (const [day, groups] of days) {
    const list = [...groups.values()];
    for (const group of list)
      group.posts.sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0));
    list.sort((a, b) => a.publishedAt.localeCompare(b.publishedAt));
    out.set(day, list);
  }
  return out;
}
