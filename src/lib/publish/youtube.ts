/**
 * Upload a video to YouTube via the Data API's resumable protocol: start a
 * session (metadata), then PUT the bytes to the returned session URI.
 *
 * A vertical video under 3 minutes becomes a Short automatically. Note: until
 * the API project passes YouTube's compliance audit, uploads are locked to
 * `private` regardless of what we request — fine for testing the pipeline.
 */
export interface YouTubeUploadInput {
  accessToken: string;
  bytes: ArrayBuffer;
  title: string;
  description?: string;
  tags?: string[];
  privacyStatus?: "private" | "unlisted" | "public";
}

export interface YouTubeUploadResult {
  videoId: string;
  url: string;
}

const RESUMABLE_INIT =
  "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status";

/**
 * Prepare a title/description for YouTube's snippet: strip the `<` and `>`
 * characters the Data API rejects (invalidTitle / invalidDescription), matching
 * how YouTube's own UI drops them, then clamp to the field's length limit. Pure.
 * Without this a stray "<3" or "A > B" 400s the whole upload after the bytes go.
 */
export function youtubeSnippetText(s: string | undefined, max: number): string {
  return (s ?? "").replace(/[<>]/g, "").slice(0, max);
}

export async function uploadYouTubeVideo(
  input: YouTubeUploadInput,
): Promise<YouTubeUploadResult> {
  const metadata = {
    snippet: {
      title: youtubeSnippetText(input.title, 100),
      description: youtubeSnippetText(input.description, 5000),
      tags: input.tags ?? [],
      categoryId: "22", // People & Blogs
    },
    status: {
      privacyStatus: input.privacyStatus ?? "private",
      selfDeclaredMadeForKids: false,
    },
  };

  const init = await fetch(RESUMABLE_INIT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Length": String(input.bytes.byteLength),
      "X-Upload-Content-Type": "video/*",
    },
    body: JSON.stringify(metadata),
  });
  if (!init.ok) {
    throw new Error(`youtube_init_${init.status}: ${await safeText(init)}`);
  }
  const session = init.headers.get("location");
  if (!session) throw new Error("youtube_no_session_uri");

  const up = await fetch(session, {
    method: "PUT",
    headers: { "Content-Type": "video/*" },
    body: input.bytes,
  });
  if (!up.ok) {
    throw new Error(`youtube_upload_${up.status}: ${await safeText(up)}`);
  }
  const json = (await up.json()) as { id?: string };
  if (!json.id) throw new Error("youtube_no_video_id");
  return { videoId: json.id, url: `https://youtube.com/watch?v=${json.id}` };
}

/**
 * Set a custom thumbnail on an uploaded video. Requires the channel to be
 * verified (phone), so callers treat a failure as non-fatal: the video is
 * already up, it just keeps YouTube's auto-generated frame.
 */
export async function setYouTubeThumbnail(
  accessToken: string,
  videoId: string,
  bytes: ArrayBuffer,
  mimeType: string,
): Promise<void> {
  const res = await fetch(
    `https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId=${videoId}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": mimeType || "image/jpeg",
      },
      body: bytes,
    },
  );
  if (!res.ok) {
    throw new Error(`youtube_thumbnail_${res.status}: ${await safeText(res)}`);
  }
}

async function safeText(res: Response): Promise<string> {
  return (await res.text().catch(() => "")).slice(0, 300);
}
