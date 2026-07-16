import type { ScrapedVideo } from "./types";

/** A positive number, else 0. Guards against missing fields and, crucially,
 * counts an actor hands back as strings ("4,200"), which must not read as views. */
const num = (v: unknown): number => (typeof v === "number" && v > 0 ? v : 0);

/** A non-empty trimmed string, else undefined. */
export const str = (v: unknown): string | undefined =>
  typeof v === "string" && v.trim() ? v : undefined;

/** Safe nested getter for actor items with unknown shapes. */
export function pick(obj: unknown, ...path: string[]): unknown {
  let cur: unknown = obj;
  for (const key of path) {
    if (cur && typeof cur === "object" && key in cur) {
      cur = (cur as Record<string, unknown>)[key];
    } else {
      return undefined;
    }
  }
  return cur;
}

/**
 * One raw Apify item to our normalized video shape, per platform. Pure and
 * defensive: the actor output is untrusted, so every field is coerced and a
 * missing one falls back rather than throwing. Kept apart from the network
 * client so this brittle field mapping can be tested on its own.
 */

/** `fallbackUrl` (the profile URL) stands in when a post has no permalink. */
export function instagramVideo(it: unknown, fallbackUrl: string): ScrapedVideo {
  return {
    url: str(pick(it, "url")) ?? fallbackUrl,
    thumbnail: str(pick(it, "displayUrl")),
    title: str(pick(it, "caption")) ?? "Instagram post",
    // Reels report videoPlayCount; feed videos report videoViewCount.
    views: num(pick(it, "videoViewCount")) || num(pick(it, "videoPlayCount")),
    likes: num(pick(it, "likesCount")),
    comments: num(pick(it, "commentsCount")),
    postedAt: str(pick(it, "timestamp")),
  };
}

export function tiktokVideo(it: unknown): ScrapedVideo {
  return {
    url: str(pick(it, "webVideoUrl")) ?? "",
    thumbnail:
      str(pick(it, "videoMeta", "coverUrl")) ??
      str(pick(it, "videoMeta", "originalCoverUrl")),
    title: str(pick(it, "text")) ?? "TikTok video",
    views: num(pick(it, "playCount")),
    likes: num(pick(it, "diggCount")),
    comments: num(pick(it, "commentCount")),
    postedAt: str(pick(it, "createTimeISO")),
  };
}

export function youtubeVideo(it: unknown): ScrapedVideo {
  return {
    url: str(pick(it, "url")) ?? "",
    thumbnail: str(pick(it, "thumbnailUrl")),
    title: str(pick(it, "title")) ?? "YouTube video",
    views: num(pick(it, "viewCount")),
    likes: num(pick(it, "likes")),
    comments: num(pick(it, "commentsCount")),
    postedAt: str(pick(it, "date")),
  };
}
