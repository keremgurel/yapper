import type { CreatorScrape } from "./apify";
import { pick, str } from "./apify-parse";
import type { ScrapedVideo } from "./types";

/**
 * Media fields asked of Business Discovery. Every one is marked Public in
 * Meta's IG Media reference; `view_count` exists only on this endpoint, and
 * `like_count` is left out by Meta when the owner hides likes.
 */
export const DISCOVERY_MEDIA_FIELDS = [
  "caption",
  "comments_count",
  "like_count",
  "view_count",
  "media_type",
  "media_url",
  "permalink",
  "thumbnail_url",
  "timestamp",
].join(",");

const num = (v: unknown): number => (typeof v === "number" && v > 0 ? v : 0);

/** Graph returns `2026-10-01T12:00:00+0000`; the rest of the feed uses the
 * `Z` form Apify returns, so both sort and display the same way. */
function isoTime(v: unknown): string | undefined {
  const raw = str(v);
  if (!raw) return undefined;
  const time = Date.parse(raw.replace(/([+-]\d{2})(\d{2})$/, "$1:$2"));
  return Number.isNaN(time) ? undefined : new Date(time).toISOString();
}

/** One Business Discovery media object to the normalized feed row. */
export function discoveryVideo(it: unknown, fallbackUrl: string): ScrapedVideo {
  // Videos carry a still in thumbnail_url; photos and albums only have
  // media_url, which for them is the image itself.
  const image =
    str(pick(it, "media_type")) === "VIDEO"
      ? str(pick(it, "thumbnail_url"))
      : (str(pick(it, "media_url")) ?? str(pick(it, "thumbnail_url")));
  return {
    url: str(pick(it, "permalink")) ?? fallbackUrl,
    thumbnail: image,
    title: str(pick(it, "caption")) ?? "Instagram post",
    views: num(pick(it, "view_count")),
    likes: num(pick(it, "like_count")),
    comments: num(pick(it, "comments_count")),
    postedAt: isoTime(pick(it, "timestamp")),
  };
}

/** The `business_discovery` object of a Graph response to a CreatorScrape. */
export function discoveryScrape(
  discovery: unknown,
  fallbackUrl: string,
): CreatorScrape {
  const media = pick(discovery, "media", "data");
  return {
    name: str(pick(discovery, "name")),
    avatar: str(pick(discovery, "profile_picture_url")),
    videos: Array.isArray(media)
      ? media.map((it) => discoveryVideo(it, fallbackUrl))
      : [],
  };
}
