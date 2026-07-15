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

export async function uploadYouTubeVideo(
  input: YouTubeUploadInput,
): Promise<YouTubeUploadResult> {
  const metadata = {
    snippet: {
      title: input.title.slice(0, 100),
      description: input.description?.slice(0, 5000) ?? "",
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

async function safeText(res: Response): Promise<string> {
  return (await res.text().catch(() => "")).slice(0, 300);
}
