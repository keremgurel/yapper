import { captionToTitle } from "./instagram-list";

const GRAPH = "https://graph.instagram.com/v21.0";

/** One of the user's own Instagram videos, as Graph describes it. `mediaUrl` is
 * null when Graph withholds the file, which leaves `permalink` as the only
 * route to it. */
export interface ImportedInstagramMedia {
  mediaUrl: string | null;
  permalink: string;
  title: string;
}

/**
 * Look up one Instagram media by id: its downloadable file URL when Graph
 * offers one, its permalink either way, and a title from its caption. Throws
 * `not_a_video` for photos and carousels, which have no single video file to
 * re-post. The id is trusted only to name the media; the file URL and permalink
 * always come back from Graph under the user's own token, so we never download
 * an attacker-supplied URL.
 */
export async function fetchInstagramMediaForImport(
  accessToken: string,
  mediaId: string,
): Promise<ImportedInstagramMedia> {
  const url = `${GRAPH}/${encodeURIComponent(
    mediaId,
  )}?fields=media_type,media_url,permalink,caption&access_token=${encodeURIComponent(
    accessToken,
  )}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`instagram_media_${res.status}`);
  const json = (await res.json()) as {
    media_type?: string;
    media_url?: string;
    permalink?: string;
    caption?: string;
  };
  if (json.media_type !== "VIDEO") throw new Error("not_a_video");
  return {
    mediaUrl: json.media_url ?? null,
    permalink: json.permalink ?? "",
    title: captionToTitle(json.caption),
  };
}
