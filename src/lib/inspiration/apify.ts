import {
  instagramMedia,
  instagramVideo,
  str,
  tiktokMedia,
  tiktokVideo,
  youtubeVideo,
} from "./apify-parse";
import { pick } from "./apify-parse";
import type { InstagramMedia, TikTokMedia } from "./apify-parse";
import type { Platform, ScrapedVideo } from "./types";

/** Result of scraping a creator profile: their normalized feed plus whatever
 * profile identity the actor happened to return. */
export interface CreatorScrape {
  name?: string;
  avatar?: string;
  videos: ScrapedVideo[];
}

const RUN_BASE = "https://api.apify.com/v2/acts";

/** Run an Apify actor synchronously and get its dataset items back in one call.
 * The response body is the items array directly. Callers keep the result count
 * modest so the run finishes well inside the sync window. */
async function runActor(
  actorId: string,
  input: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<unknown[]> {
  const token = process.env.APIFY_TOKEN;
  if (!token) throw new Error("no_apify_token");

  const res = await fetch(
    `${RUN_BASE}/${actorId}/run-sync-get-dataset-items?token=${token}&clean=true`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      signal,
    },
  );
  if (!res.ok) throw new Error(`apify_${actorId}_${res.status}`);
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

async function scrapeInstagram(
  url: string,
  max: number,
): Promise<CreatorScrape> {
  const items = await runActor("apify~instagram-scraper", {
    directUrls: [url],
    resultsType: "posts",
    resultsLimit: max,
  });
  return {
    name: str(pick(items[0], "ownerFullName")),
    videos: items.map((it) => instagramVideo(it, url)),
  };
}

/**
 * Resolve a single Instagram post or Reel to its public CDN media URL. The
 * oEmbed/Open Graph path only exposes card metadata; the media URL is what lets
 * the transcription provider hear the actual reference.
 */
export async function resolveInstagramMedia(
  url: string,
  signal?: AbortSignal,
): Promise<InstagramMedia> {
  const items = await runActor(
    "apify~instagram-scraper",
    {
      directUrls: [url],
      resultsType: "posts",
      resultsLimit: 1,
    },
    signal,
  );
  return instagramMedia(items[0]);
}

/** Resolve one TikTok post to the CDN video used for transcription. */
export async function resolveTikTokMedia(url: string): Promise<TikTokMedia> {
  const items = await runActor("clockworks~tiktok-video-scraper", {
    postURLs: [url],
    shouldDownloadCovers: false,
    shouldDownloadSlideshowImages: false,
    shouldDownloadSubtitles: false,
    shouldDownloadVideos: false,
  });
  return tiktokMedia(items[0]);
}

async function scrapeTikTok(
  handle: string,
  max: number,
): Promise<CreatorScrape> {
  const items = await runActor("clockworks~free-tiktok-scraper", {
    profiles: [handle],
    resultsPerPage: max,
    profileScrapeSections: ["videos"],
    profileSorting: "latest",
    shouldDownloadVideos: false,
    shouldDownloadCovers: false,
  });
  return {
    name: str(pick(items[0], "authorMeta", "nickName")),
    avatar: str(pick(items[0], "authorMeta", "avatar")),
    videos: items.map(tiktokVideo).filter((v) => v.url),
  };
}

async function scrapeYouTube(url: string, max: number): Promise<CreatorScrape> {
  // The channel feed lives at /videos; normalize whatever profile URL we got.
  const channelUrl = url.replace(/\/+$/, "").endsWith("/videos")
    ? url
    : `${url.replace(/\/+$/, "")}/videos`;
  const items = await runActor("streamers~youtube-scraper", {
    startUrls: [{ url: channelUrl }],
    maxResults: max,
    sortVideosBy: "NEWEST",
  });
  return {
    name: str(pick(items[0], "channelName")),
    videos: items.map(youtubeVideo).filter((v) => v.url),
  };
}

/**
 * Scrape a creator's recent feed on the given platform. Throws on an
 * unsupported platform or an actor failure (the caller degrades gracefully).
 *
 * `max` is billed, not just fetched: every actor here charges per result, so
 * asking for more posts than the caller displays is money spent on rows that
 * are sliced off and thrown away.
 */
export async function scrapeCreator(
  platform: Platform,
  url: string,
  handle: string | undefined,
  max: number,
): Promise<CreatorScrape> {
  switch (platform) {
    case "instagram":
      return scrapeInstagram(url, max);
    case "tiktok":
      if (!handle) throw new Error("no_handle");
      return scrapeTikTok(handle, max);
    case "youtube":
      return scrapeYouTube(url, max);
    default:
      throw new Error("unsupported_platform");
  }
}
