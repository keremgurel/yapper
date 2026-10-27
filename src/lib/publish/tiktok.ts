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
  fetchBoundedJsonWithText,
  fetchBoundedResponse,
  OutboundHttpError,
} from "@/lib/http/outbound";
import { openFileBody, type StreamingRequestInit } from "./file-body";
import {
  PublishOutcomeUnknownError,
  remainingPublishMs,
  type PublishWorkflow,
} from "./workflow";

const MAX_WHOLE_FILE = 64 * 1024 * 1024;
const MULTIPART_CHUNK = 32 * 1024 * 1024;

export interface TikTokUploadInput {
  accessToken: string;
  filePath: string;
  byteLength: number;
  contentType: string;
  /** Persist the provider identity before sending any irreversible bytes. */
  onInitialized?: (publishId: string) => Promise<void>;
}

export class TikTokPublishError extends Error {
  constructor(
    public readonly code: string,
    public readonly logId?: string,
  ) {
    super(`tiktok_${code}`);
    this.name = "TikTokPublishError";
  }
}

class TikTokUploadFailedError extends TikTokPublishError {}

interface TikTokStatusData {
  status?: string;
  uploaded_bytes?: unknown;
  fail_reason?: string;
  /** Exact decimal ids, read from the raw body by exactPublicPostIds. */
  publicaly_available_post_id?: string[];
}

// TikTok sends public post ids as int64 numbers. Real ids run 19 digits, past
// Number.MAX_SAFE_INTEGER, so JSON.parse rounds them into another video's id.
// Read the digits from the raw body instead. An array holding anything but
// digit runs (quoted or bare) yields no ids.
const PUBLIC_POST_IDS = /"publicaly_available_post_id"\s*:\s*\[([\s\d",]*)\]/;

function exactPublicPostIds(body: string): string[] | undefined {
  return PUBLIC_POST_IDS.exec(body)?.[1].match(/\d+/g) ?? undefined;
}

export interface TikTokUploadResult {
  publishId: string;
}

/**
 * TikTok accepts a whole-file upload only through 64MB. Above that threshold it
 * requires multiple chunks, with every non-final chunk between 5MB and 64MB.
 * Using 32MB produces at least two chunks immediately above the threshold and
 * leaves a 32-64MB final chunk that absorbs the remainder. TikTok defines
 * total_chunk_count as floor(video_size / chunk_size).
 */
export function planChunks(size: number): { chunkSize: number; count: number } {
  if (size <= MAX_WHOLE_FILE) return { chunkSize: size, count: 1 };
  return {
    chunkSize: MULTIPART_CHUNK,
    count: Math.floor(size / MULTIPART_CHUNK),
  };
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
    error?: { code?: string; message?: string; log_id?: string };
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
  if (!response.ok || (json.error?.code && json.error.code !== "ok")) {
    if (json.error?.code && json.error.code !== "ok") {
      throw new TikTokPublishError(json.error.code, json.error.log_id);
    }
    const code = (json.error?.code ?? "unknown").slice(0, 100);
    const message = (
      json.error?.message ?? "upload initialization failed"
    ).slice(0, 300);
    throw new Error(`tiktok_init_${response.status}: ${code}: ${message}`);
  }
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

export async function fetchTikTokPostStatus(
  accessToken: string,
  publishId: string,
  workflow: PublishWorkflow,
): Promise<TikTokStatusData> {
  const { response, data, text } = await fetchBoundedJsonWithText<{
    data?: Omit<TikTokStatusData, "publicaly_available_post_id">;
    error?: { code?: string; log_id?: string };
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
  if (data.error?.code && data.error.code !== "ok") {
    throw new TikTokPublishError(data.error.code, data.error.log_id);
  }
  if (!response.ok) throw new Error(`tiktok_status_${response.status}`);
  if (!data.data?.status) throw new Error("tiktok_status_missing");
  return {
    ...data.data,
    publicaly_available_post_id: exactPublicPostIds(text),
  };
}

async function uploadedBytes(
  accessToken: string,
  publishId: string,
  total: number,
  workflow: PublishWorkflow,
): Promise<number> {
  const data = await fetchTikTokPostStatus(accessToken, publishId, workflow);
  if (data.status === "FAILED") {
    throw new TikTokUploadFailedError(data.fail_reason ?? "upload_failed");
  }
  if (
    data.status === "SEND_TO_USER_INBOX" ||
    data.status === "PUBLISH_COMPLETE"
  )
    return total;
  const value = data.uploaded_bytes;
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
  await input.onInitialized?.(publishId);

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
        if (error instanceof TikTokUploadFailedError) throw error;
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
        if (error instanceof TikTokUploadFailedError) throw error;
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
        try {
          await retryDelay(2_000 * 2 ** attempt, workflow.signal);
        } catch (error) {
          throw new PublishOutcomeUnknownError("tiktok", error);
        }
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
