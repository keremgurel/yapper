/**
 * Send a video to the user's TikTok drafts (inbox) via the Content Posting API.
 * We use the inbox flow, not direct-post: until the app passes TikTok's
 * direct-post audit, this is the honest path. The video appears in the user's
 * TikTok notifications and they tap to finish and publish it.
 *
 * The flow is: init (announce the size) then PUT the bytes to the returned
 * upload URL. TikTok caps a chunk at 64MB, so larger files are sent in chunks
 * with the final chunk absorbing the remainder (its own rule).
 */
const INBOX_INIT =
  "https://open.tiktokapis.com/v2/post/publish/inbox/video/init/";

const MAX_CHUNK = 64 * 1024 * 1024; // 64MB, TikTok's per-chunk ceiling.

export interface TikTokUploadInput {
  accessToken: string;
  bytes: ArrayBuffer;
}

export interface TikTokUploadResult {
  publishId: string;
}

async function safeText(res: Response): Promise<string> {
  return (await res.text().catch(() => "")).slice(0, 300);
}

/** Chunk plan honoring TikTok's rules: whole file in one chunk when it fits,
 * otherwise fixed-size chunks with the last one running to the end. */
function planChunks(size: number): { chunkSize: number; count: number } {
  if (size <= MAX_CHUNK) return { chunkSize: size, count: 1 };
  const count = Math.floor(size / MAX_CHUNK);
  return { chunkSize: MAX_CHUNK, count };
}

async function initUpload(
  accessToken: string,
  size: number,
): Promise<{
  publishId: string;
  uploadUrl: string;
  chunkSize: number;
  count: number;
}> {
  const { chunkSize, count } = planChunks(size);
  const res = await fetch(INBOX_INIT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json; charset=UTF-8",
    },
    body: JSON.stringify({
      source_info: {
        source: "FILE_UPLOAD",
        video_size: size,
        chunk_size: chunkSize,
        total_chunk_count: count,
      },
    }),
  });
  if (!res.ok) {
    throw new Error(`tiktok_init_${res.status}: ${await safeText(res)}`);
  }
  const json = (await res.json()) as {
    data?: { publish_id?: string; upload_url?: string };
    error?: { code?: string; message?: string };
  };
  const publishId = json.data?.publish_id;
  const uploadUrl = json.data?.upload_url;
  if (!publishId || !uploadUrl) {
    throw new Error(
      `tiktok_init_bad: ${json.error?.message ?? "no upload url"}`,
    );
  }
  return { publishId, uploadUrl, chunkSize, count };
}

async function putChunk(
  uploadUrl: string,
  bytes: ArrayBuffer,
  start: number,
  end: number,
  total: number,
): Promise<void> {
  // end is inclusive in a Content-Range header.
  const slice = bytes.slice(start, end + 1);
  const res = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": "video/mp4",
      "Content-Length": String(slice.byteLength),
      "Content-Range": `bytes ${start}-${end}/${total}`,
    },
    body: slice,
  });
  if (!res.ok) {
    throw new Error(`tiktok_upload_${res.status}: ${await safeText(res)}`);
  }
}

export async function uploadTikTokDraft(
  input: TikTokUploadInput,
): Promise<TikTokUploadResult> {
  const size = input.bytes.byteLength;
  if (size === 0) throw new Error("tiktok_empty_video");
  const { publishId, uploadUrl, chunkSize, count } = await initUpload(
    input.accessToken,
    size,
  );

  for (let i = 0; i < count; i++) {
    const start = i * chunkSize;
    // The final chunk runs to the end of the file (absorbs any remainder).
    const end = i === count - 1 ? size - 1 : start + chunkSize - 1;
    await putChunk(uploadUrl, input.bytes, start, end, size);
  }
  return { publishId };
}
