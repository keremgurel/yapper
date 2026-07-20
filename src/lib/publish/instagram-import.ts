import { captionToTitle } from "./instagram-list";

const GRAPH = "https://graph.instagram.com/v21.0";

export interface ImportedInstagramMedia {
  mediaUrl: string;
  title: string;
}

/**
 * Look up one Instagram media by id and return its downloadable file URL plus a
 * title from its caption. Throws `not_a_video` for photos and carousels, which
 * have no single video file to re-post. The id is trusted only to name the
 * media; the file URL always comes back from Graph under the user's own token,
 * so we never download an attacker-supplied URL.
 */
export async function fetchInstagramMediaForImport(
  accessToken: string,
  mediaId: string,
): Promise<ImportedInstagramMedia> {
  const url = `${GRAPH}/${encodeURIComponent(
    mediaId,
  )}?fields=media_type,media_url,caption&access_token=${encodeURIComponent(
    accessToken,
  )}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`instagram_media_${res.status}`);
  const json = (await res.json()) as {
    media_type?: string;
    media_url?: string;
    caption?: string;
  };
  if (json.media_type !== "VIDEO" || !json.media_url) {
    throw new Error("not_a_video");
  }
  return { mediaUrl: json.media_url, title: captionToTitle(json.caption) };
}
