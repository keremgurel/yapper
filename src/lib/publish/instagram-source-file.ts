import { resolveInstagramMedia } from "@/lib/inspiration/apify";
import type { ImportedInstagramMedia } from "./instagram-import";

/**
 * The downloadable file for one of the creator's own Instagram videos.
 *
 * Graph hands back `media_url` for most media, but withholds it for any Reel
 * carrying licensed audio from Instagram's music library — which tends to be
 * the newest and most-posted ones. For those the public permalink is the only
 * remaining route to the file, and the Inspiration flow already resolves a
 * permalink to its CDN video, so the Poster reuses that resolver rather than
 * telling a creator their own Reel cannot be cross-posted.
 *
 * Graph first: it is free, instant, and authenticated. The scrape runs only
 * when Graph gave us nothing.
 */
export async function resolveInstagramSourceFile(
  media: ImportedInstagramMedia,
): Promise<string> {
  if (media.mediaUrl) return media.mediaUrl;
  if (!media.permalink) throw new Error("no_source_file");

  const scraped = await resolveInstagramMedia(media.permalink);
  if (!scraped.mediaUrl) throw new Error("no_source_file");
  return scraped.mediaUrl;
}
