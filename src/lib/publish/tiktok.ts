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
const STATUS_FETCH =
  "https://open.tiktokapis.com/v2/post/publish/status/fetch/";

import {
  fetchBoundedJson,
  fetchBoundedResponse,
  OutboundHttpError,
} from "@/lib/http/outbound";
import { openFileBody, type StreamingRequestInit } from "./file-body";
import {
  PublishOutcomeUnknownError,
  remainingPublishMs,
  type PublishWorkflow,
} from "./workflow";

const MAX_CHUNK = 64 * 1024 * 1024; // 64MB, TikTok's per-chunk ceiling when splitting.
const MAX_SINGLE = 128 * 1024 * 1024; // A single (final) chunk may run up to 128MB.

export interface TikTokUploadInput {
  accessToken: string;
  filePath: string;
  byteLength: number;
  contentType: string;
}

export interface TikTokUploadResult {
  publishId: string;
}

/**
 * Chunk plan honoring TikTok's rules. A file that fits a single chunk (up to
 * 128MB, the final-chunk ceiling) is announced as chunk_size = video_size,
 * count = 1 — TikTok's documented whole-file shape. Announcing a 64MB chunk with
 * count 1 for, say, a 100MB file is inconsistent (64MB x 1 != 100MB) and can be
 * rejected. Larger files split into 64MB chunks with the last absorbing the
 * remainder (which stays under 128MB, so total_chunk_count = floor(size/64MB)).
 */
export function planChunks(size: number): { chunkSize: number; count: number } {
  if (size <= MAX_SINGLE) return { chunkSize: size, count: 1 };
  const count = Math.floor(size / MAX_CHUNK);
  return { chunkSize: MAX_CHUNK, count };
}

async function initUpload(
  accessToken: string,
  size: number,
  workflow: PublishWorkflow,
): Promise<{
  publishId: string;
  uploadUrl: string;
  chunkSize: number;
  count: number;
}> {
  const { chunkSize, count } = planChunks(size);
  const { response, data: json } = await fetchBoundedJson<{
    data?: { publish_id?: string; upload_url?: string };
    error?: { code?: string; message?: string };
  }>(
    INBOX_INIT,
    {
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
    },
    {
      timeoutMs: remainingPublishMs(workflow, 20_000),
      maxBytes: 256 * 1024,
      signal: workflow.signal,
    },
  );
  if (!response.ok) throw new Error(`tiktok_init_${response.status}`);
  const publishId = json.data?.publish_id;
  const uploadUrl = json.data?.upload_url;
  if (!publishId || !uploadUrl) {
    throw new Error(
      `tiktok_init_bad: ${(json.error?.message ?? "no upload url").slice(0, 300)}`,
    );
  }
  return { publishId, uploadUrl, chunkSize, count };
}

async function putChunk(
  uploadUrl: string,
  filePath: string,
  contentType: string,
  start: number,
  end: number,
  total: number,
  workflow: PublishWorkflow,
): Promise<number> {
  // end is inclusive in a Content-Range header.
  const length = end - start + 1;
  const remaining = remainingPublishMs(workflow);
  if (remaining <= 15_000) throw new OutboundHttpError("timeout");
  const opened = openFileBody(filePath, { start, end });
  try {
    const init: StreamingRequestInit = {
      method: "PUT",
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(length),
        "Content-Range": `bytes ${start}-${end}/${total}`,
      },
      body: opened.body,
      duplex: "half",
    };
    const { response } = await fetchBoundedResponse(uploadUrl, init, {
      // Preserve enough of the absolute budget to resolve an ambiguous chunk
      // against TikTok's status endpoint before deciding whether to retry.
      timeoutMs: Math.min(90_000, remaining - 15_000),
      maxBytes: 64 * 1024,
      signal: workflow.signal,
    });
    return response.status;
  } finally {
    opened.close();
  }
}

async function uploadedBytes(
  accessToken: string,
  publishId: string,
  total: number,
  workflow: PublishWorkflow,
): Promise<number> {
  const { response, data } = await fetchBoundedJson<{
    data?: { status?: unknown; uploaded_bytes?: unknown };
  }>(
    STATUS_FETCH,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json; charset=UTF-8",
      },
      body: JSON.stringify({ publish_id: publishId }),
    },
    {
      timeoutMs: remainingPublishMs(workflow, 15_000),
      maxBytes: 256 * 1024,
      signal: workflow.signal,
    },
  );
  if (!response.ok) throw new Error(`tiktok_status_${response.status}`);
  if (data.data?.status === "FAILED") throw new Error("tiktok_upload_failed");
  const value = data.data?.uploaded_bytes;
  if (
    !Number.isSafeInteger(value) ||
    (value as number) < 0 ||
    (value as number) > total
  ) {
    throw new Error("tiktok_bad_upload_progress");
  }
  return value as number;
}

function retryDelay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new OutboundHttpError("aborted", { cause: signal.reason }));
      return;
    }
    const timer = setTimeout(done, ms);
    function done() {
      signal.removeEventListener("abort", aborted);
      resolve();
    }
    function aborted() {
      clearTimeout(timer);
      signal.removeEventListener("abort", aborted);
      reject(new OutboundHttpError("aborted", { cause: signal.reason }));
    }
    signal.addEventListener("abort", aborted, { once: true });
  });
}

export async function uploadTikTokDraft(
  input: TikTokUploadInput,
  workflow: PublishWorkflow,
): Promise<TikTokUploadResult> {
  const size = input.byteLength;
  if (size === 0) throw new Error("tiktok_empty_video");
  const { publishId, uploadUrl, chunkSize, count } = await initUpload(
    input.accessToken,
    size,
    workflow,
  );

  for (let i = 0; i < count; i++) {
    const start = i * chunkSize;
    // The final chunk runs to the end of the file (absorbs any remainder).
    const end = i === count - 1 ? size - 1 : start + chunkSize - 1;
    const expectedStatus = i === count - 1 ? 201 : 206;
    let completed = false;
    let lastError: unknown;
    for (let attempt = 0; attempt < 3 && !completed; attempt++) {
      try {
        const status = await putChunk(
          uploadUrl,
          input.filePath,
          input.contentType,
          start,
          end,
          size,
          workflow,
        );
        if (status === expectedStatus) {
          completed = true;
          break;
        }
        if (status < 500 && status !== 416) {
          throw new Error(`tiktok_upload_${status}`);
        }
        lastError = new Error(`tiktok_upload_${status}`);
      } catch (error) {
        if (
          error instanceof OutboundHttpError &&
          (error.code === "aborted" ||
            (error.code === "timeout" && Date.now() >= workflow.deadlineAt))
        ) {
          throw new PublishOutcomeUnknownError("tiktok", error);
        }
        if (
          error instanceof Error &&
          /^tiktok_upload_4\d\d$/.test(error.message) &&
          error.message !== "tiktok_upload_416"
        ) {
          throw error;
        }
        lastError = error;
      }

      try {
        const progress = await uploadedBytes(
          input.accessToken,
          publishId,
          size,
          workflow,
        );
        if (progress >= end + 1) {
          completed = true;
          break;
        }
        if (progress !== start) throw new Error("tiktok_bad_upload_progress");
      } catch (error) {
        if (
          error instanceof OutboundHttpError &&
          (error.code === "aborted" ||
            (error.code === "timeout" && Date.now() >= workflow.deadlineAt))
        ) {
          throw new PublishOutcomeUnknownError("tiktok", error);
        }
        lastError = error;
      }
      if (attempt < 2) {
        await retryDelay(250 * 2 ** attempt, workflow.signal);
      }
    }
    if (!completed) {
      if (
        lastError instanceof Error &&
        lastError.message === "tiktok_upload_failed"
      ) {
        throw lastError;
      }
      throw new PublishOutcomeUnknownError("tiktok", lastError);
    }
  }
  return { publishId };
}
