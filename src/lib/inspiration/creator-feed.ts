import { scrapeCreator, type CreatorScrape } from "./apify";
import { getDiscoveryAccess } from "./business-discovery-access";
import {
  fetchBusinessDiscovery,
  linkedInstagramId,
} from "./business-discovery";
import { fetchYouTubeCreator } from "./youtube-data-api";
import type { Platform } from "./types";
import { getFreshAccessToken } from "@/lib/publish/connection";

/**
 * How many of a creator's recent posts one analysis looks at.
 *
 * This is a spend limit as much as a display limit. Every scraper bills per
 * result, so the number requested and the number rendered have to be the same
 * number: asking for 30 and showing 24 is six posts paid for and discarded on
 * every single analysis.
 */
export const CREATOR_FEED_LIMIT = 24;

/** YouTube's Data API, under the `youtube.readonly` scope already held for
 * publishing. Null when the user has not connected it or the API declines. */
async function viaYouTubeApi(
  userId: string,
  url: string,
): Promise<CreatorScrape | null> {
  try {
    const token = await getFreshAccessToken(userId, "youtube");
    return await fetchYouTubeCreator(url, token, CREATOR_FEED_LIMIT);
  } catch (e) {
    console.warn(
      "[inspiration] youtube api unavailable, falling back to scrape",
      e instanceof Error ? e.message : e,
    );
    return null;
  }
}

/** Meta's Business Discovery, asked through the user's Facebook connection
 * and its linked Instagram account. Null when that connection lacks the
 * Instagram scopes or Meta declines (personal or age-gated targets). */
async function viaBusinessDiscovery(
  userId: string,
  url: string,
  handle: string | undefined,
): Promise<CreatorScrape | null> {
  if (!handle) return null;
  try {
    const access = await getDiscoveryAccess(userId);
    if (!access) return null;
    const igUserId = await linkedInstagramId(
      access.userToken,
      access.selectedPageId,
    );
    return await fetchBusinessDiscovery(
      igUserId,
      access.userToken,
      handle,
      url,
      CREATOR_FEED_LIMIT,
    );
  } catch (e) {
    console.warn(
      "[inspiration] business discovery unavailable, falling back to scrape",
      e instanceof Error ? e.message : e,
    );
    return null;
  }
}

/**
 * A creator's recent feed, from the cheapest source that can serve it.
 *
 * YouTube's Data API answers for any public channel, and Instagram's Business
 * Discovery for any professional account, both free and unbreakable by markup
 * changes. TikTok has no equivalent, so it always goes to metered scraping.
 * The free sources fall back to the scraper when the user has not connected
 * them or the API declines, so a missing connection costs money but never the
 * feature.
 */
export async function fetchCreatorFeed(
  userId: string,
  platform: Platform,
  url: string,
  handle: string | undefined,
): Promise<CreatorScrape> {
  const free =
    platform === "youtube"
      ? await viaYouTubeApi(userId, url)
      : platform === "instagram"
        ? await viaBusinessDiscovery(userId, url, handle)
        : null;
  return free ?? scrapeCreator(platform, url, handle, CREATOR_FEED_LIMIT);
}
