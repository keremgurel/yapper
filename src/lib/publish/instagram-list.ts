/**
 * List the connected Instagram account's own videos and Reels, the media that
 * can be re-posted elsewhere. Instagram Login / Graph, read scope
 * `instagram_business_basic`. `sourceFileUrl` is the file Instagram serves for
 * the media, which the cross-post pipeline downloads and re-uploads to another
 * platform. Photos and carousels are dropped: there is no single video file to
 * backfill from them.
 */
const GRAPH = "https://graph.instagram.com/v21.0";

/** One Instagram video, shaped like the shared PlatformVideo the Poster renders
 * plus `sourceFileUrl`: the downloadable file that makes it a backfill source. */
export interface InstagramVideo {
  id: string;
  title: string;
  thumbnail: string | null;
  viewCount: number;
  publishedAt: string;
  privacyStatus: string;
  url: string;
  sourceFileUrl: string;
}

/** One item from the Graph `me/media` edge, only the fields we request. */
export interface InstagramMedia {
  id?: string;
  caption?: string;
  media_type?: string;
  media_url?: string;
  thumbnail_url?: string;
  permalink?: string;
  timestamp?: string;
}

/**
 * A short title from a caption: the first non-empty line, trimmed. Instagram
 * has no title field, so the caption's opening line stands in; an empty or
 * missing caption yields "" and the UI shows "Untitled". Pure, so the mapping
 * and any test agree on exactly what a row is titled.
 */
export function captionToTitle(caption: string | undefined): string {
  return (
    (caption ?? "")
      .split("\n")
      .map((line) => line.trim())
      .find(Boolean) ?? ""
  );
}

/**
 * Map raw `me/media` items to backfill sources: keep only VIDEO media that has
 * a real id and a downloadable `media_url`, newest first. Pure so the route and
 * its test agree on which media are postable and how each row is shaped.
 */
export function mapInstagramMedia(data: InstagramMedia[]): InstagramVideo[] {
  return data
    .filter(
      (m): m is InstagramMedia & { id: string; media_url: string } =>
        m.media_type === "VIDEO" && Boolean(m.id) && Boolean(m.media_url),
    )
    .map((m) => ({
      id: m.id,
      title: captionToTitle(m.caption),
      thumbnail: m.thumbnail_url ?? null,
      viewCount: 0,
      publishedAt: m.timestamp ?? "",
      privacyStatus: "public",
      url: m.permalink ?? "",
      sourceFileUrl: m.media_url,
    }))
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}

/** The connected account's own videos and Reels, newest first. */
export async function listInstagramVideos(
  accessToken: string,
  max = 50,
): Promise<InstagramVideo[]> {
  const fields =
    "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp";
  const url = `${GRAPH}/me/media?fields=${fields}&limit=${max}&access_token=${encodeURIComponent(
    accessToken,
  )}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`instagram_media_${res.status}`);
  const json = (await res.json()) as { data?: InstagramMedia[] };
  return mapInstagramMedia(json.data ?? []);
}
