import {
  instagramVideo,
  pick,
  str,
  tiktokVideo,
  youtubeVideo,
} from "./apify-parse";
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
 * The response body is the items array directly. Kept modest (30 items) so the
 * run finishes well inside the sync window. */
async function runActor(
  actorId: string,
  input: Record<string, unknown>,
): Promise<unknown[]> {
  const token = process.env.APIFY_TOKEN;
  if (!token) throw new Error("no_apify_token");

  const res = await fetch(
    `${RUN_BASE}/${actorId}/run-sync-get-dataset-items?token=${token}&clean=true`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  );
  if (!res.ok) throw new Error(`apify_${actorId}_${res.status}`);
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

async function scrapeInstagram(url: string): Promise<CreatorScrape> {
  const items = await runActor("apify~instagram-scraper", {
    directUrls: [url],
    resultsType: "posts",
    resultsLimit: 30,
  });
  return {
    name: str(pick(items[0], "ownerFullName")),
    videos: items.map((it) => instagramVideo(it, url)),
  };
}

async function scrapeTikTok(handle: string): Promise<CreatorScrape> {
  const items = await runActor("clockworks~free-tiktok-scraper", {
    profiles: [handle],
    resultsPerPage: 30,
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

async function scrapeYouTube(url: string): Promise<CreatorScrape> {
  // The channel feed lives at /videos; normalize whatever profile URL we got.
  const channelUrl = url.replace(/\/+$/, "").endsWith("/videos")
    ? url
    : `${url.replace(/\/+$/, "")}/videos`;
  const items = await runActor("streamers~youtube-scraper", {
    startUrls: [{ url: channelUrl }],
    maxResults: 30,
    sortVideosBy: "NEWEST",
  });
  return {
    name: str(pick(items[0], "channelName")),
    videos: items.map(youtubeVideo).filter((v) => v.url),
  };
}

/** Scrape a creator's recent feed on the given platform. Throws on an
 * unsupported platform or an actor failure (the caller degrades gracefully). */
export async function scrapeCreator(
  platform: Platform,
  url: string,
  handle: string | undefined,
): Promise<CreatorScrape> {
  switch (platform) {
    case "instagram":
      return scrapeInstagram(url);
    case "tiktok":
      if (!handle) throw new Error("no_handle");
      return scrapeTikTok(handle);
    case "youtube":
      return scrapeYouTube(url);
    default:
      throw new Error("unsupported_platform");
  }
}
