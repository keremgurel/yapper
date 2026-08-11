import { scrapeCreator, type CreatorScrape } from "./apify";
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

/**
 * A creator's recent feed, from the cheapest source that can serve it.
 *
 * YouTube's Data API answers for any public channel under the
 * `youtube.readonly` scope we already hold for publishing: free, sub-second,
 * and unbreakable by markup changes. Instagram and TikTok have no equivalent,
 * since their APIs only ever describe the token holder's own account, so those
 * go to metered scraping. YouTube falls back to the scraper too when the user
 * has not connected it or the API declines, so a missing connection costs
 * money but never the feature.
 */
export async function fetchCreatorFeed(
  userId: string,
  platform: Platform,
  url: string,
  handle: string | undefined,
): Promise<CreatorScrape> {
  if (platform === "youtube") {
    try {
      const token = await getFreshAccessToken(userId, "youtube");
      return await fetchYouTubeCreator(url, token, CREATOR_FEED_LIMIT);
    } catch (e) {
      console.warn(
        "[inspiration] youtube api unavailable, falling back to scrape",
        e instanceof Error ? e.message : e,
      );
    }
  }
  return scrapeCreator(platform, url, handle, CREATOR_FEED_LIMIT);
}
