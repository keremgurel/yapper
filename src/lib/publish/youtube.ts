import {
  fetchBoundedResponse,
  fetchBoundedText,
  OutboundHttpError,
} from "@/lib/http/outbound";
import { openFileBody, type StreamingRequestInit } from "./file-body";
import {
  PublishOutcomeUnknownError,
  remainingPublishMs,
  type PublishWorkflow,
} from "./workflow";

/**
 * Upload a video to YouTube via one resumable session. Media is streamed from
 * an owned temporary file, and ambiguous upload failures are resolved against
 * the same session instead of creating a duplicate video.
 */
export interface YouTubeUploadInput {
  accessToken: string;
  filePath: string;
  byteLength: number;
  contentType: string;
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
const CONTROL_RESPONSE_BYTES = 1024 * 1024;

export function youtubeSnippetText(s: string | undefined, max: number): string {
  return (s ?? "").replace(/[<>]/g, "").slice(0, max);
}

function parseVideoId(bytes: Uint8Array): string {
  try {
    const json = JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(bytes),
    ) as {
      id?: unknown;
    };
    if (typeof json.id === "string" && json.id) return json.id;
  } catch (cause) {
    throw new OutboundHttpError("invalid_response", { cause });
  }
  throw new Error("youtube_no_video_id");
}

async function startSession(
  input: YouTubeUploadInput,
  workflow: PublishWorkflow,
): Promise<string> {
  const metadata = {
    snippet: {
      title: youtubeSnippetText(input.title, 100),
      description: youtubeSnippetText(input.description, 5000),
      tags: input.tags ?? [],
      categoryId: "22",
    },
    status: {
      privacyStatus: input.privacyStatus ?? "public",
      selfDeclaredMadeForKids: false,
    },
  };
  const { response, text } = await fetchBoundedText(
    RESUMABLE_INIT,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.accessToken}`,
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Length": String(input.byteLength),
        "X-Upload-Content-Type": input.contentType,
      },
      body: JSON.stringify(metadata),
    },
    {
      timeoutMs: remainingPublishMs(workflow, 20_000),
      maxBytes: 256 * 1024,
      signal: workflow.signal,
    },
  );
  if (!response.ok) {
    throw new Error(`youtube_init_${response.status}: ${text.slice(0, 300)}`);
  }
  const session = response.headers.get("location");
  if (!session) throw new Error("youtube_no_session_uri");
  return session;
}

async function putRange(
  session: string,
  input: YouTubeUploadInput,
  start: number,
  workflow: PublishWorkflow,
): Promise<{ response: Response; bytes: Uint8Array }> {
  const remaining = remainingPublishMs(workflow);
  if (remaining <= 15_000) throw new OutboundHttpError("timeout");
  const opened = openFileBody(input.filePath, {
    start,
    end: input.byteLength - 1,
  });
  try {
    const init: StreamingRequestInit = {
      method: "PUT",
      headers: {
        "Content-Type": input.contentType,
        "Content-Length": String(input.byteLength - start),
        "Content-Range": `bytes ${start}-${input.byteLength - 1}/${input.byteLength}`,
      },
      body: opened.body,
      duplex: "half",
    };
    return await fetchBoundedResponse(session, init, {
      // Preserve enough of the one workflow budget to query the same session
      // after a stalled/ambiguous upload response.
      timeoutMs: Math.min(240_000, remaining - 15_000),
      maxBytes: CONTROL_RESPONSE_BYTES,
      signal: workflow.signal,
    });
  } finally {
    opened.close();
  }
}

async function querySession(
  session: string,
  total: number,
  workflow: PublishWorkflow,
): Promise<{ completeId?: string; nextByte: number }> {
  const { response, bytes } = await fetchBoundedResponse(
    session,
    {
      method: "PUT",
      headers: {
        "Content-Length": "0",
        "Content-Range": `bytes */${total}`,
      },
    },
    {
      timeoutMs: remainingPublishMs(workflow, 20_000),
      maxBytes: CONTROL_RESPONSE_BYTES,
      signal: workflow.signal,
    },
  );
  if (response.ok) return { completeId: parseVideoId(bytes), nextByte: total };
  if (response.status !== 308) {
    throw new Error(`youtube_status_${response.status}`);
  }
  const range = response.headers.get("range");
  if (!range) return { nextByte: 0 };
  const match = /^bytes=0-([0-9]+)$/.exec(range.trim());
  if (!match) throw new Error("youtube_bad_resume_range");
  const last = Number(match[1]);
  if (!Number.isSafeInteger(last) || last < 0 || last >= total) {
    throw new Error("youtube_bad_resume_range");
  }
  return { nextByte: last + 1 };
}

export async function uploadYouTubeVideo(
  input: YouTubeUploadInput,
  workflow: PublishWorkflow,
): Promise<YouTubeUploadResult> {
  if (!Number.isSafeInteger(input.byteLength) || input.byteLength <= 0) {
    throw new Error("youtube_empty_video");
  }
  const session = await startSession(input, workflow);
  let start = 0;

  // Recovery always uses the same YouTube session, so an ambiguous response
  // cannot create a duplicate post. Three probes bound pathological sessions.
  for (let recovery = 0; recovery < 4; recovery++) {
    let upload: { response: Response; bytes: Uint8Array } | undefined;
    try {
      upload = await putRange(session, input, start, workflow);
    } catch {
      // Network failures and provider 5xx responses are ambiguous. Query this
      // session under the remaining workflow budget before sending more bytes.
    }

    if (upload?.response.ok) {
      const videoId = parseVideoId(upload.bytes);
      return { videoId, url: `https://youtube.com/watch?v=${videoId}` };
    }
    if (
      upload &&
      upload.response.status !== 308 &&
      upload.response.status < 500
    ) {
      throw new Error(`youtube_upload_${upload.response.status}`);
    }

    let status;
    try {
      status = await querySession(session, input.byteLength, workflow);
    } catch (error) {
      throw new PublishOutcomeUnknownError("youtube", error);
    }
    if (status.completeId) {
      return {
        videoId: status.completeId,
        url: `https://youtube.com/watch?v=${status.completeId}`,
      };
    }
    start = status.nextByte;
  }
  throw new PublishOutcomeUnknownError("youtube");
}

export interface YouTubeThumbnailInput {
  accessToken: string;
  videoId: string;
  filePath: string;
  byteLength: number;
  mimeType: string;
}

export async function setYouTubeThumbnail(
  input: YouTubeThumbnailInput,
  workflow: PublishWorkflow,
): Promise<void> {
  const opened = openFileBody(input.filePath);
  try {
    const init: StreamingRequestInit = {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.accessToken}`,
        "Content-Type": input.mimeType || "image/jpeg",
        "Content-Length": String(input.byteLength),
      },
      body: opened.body,
      duplex: "half",
    };
    const { response } = await fetchBoundedResponse(
      `https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId=${input.videoId}`,
      init,
      {
        timeoutMs: remainingPublishMs(workflow, 30_000),
        maxBytes: CONTROL_RESPONSE_BYTES,
        signal: workflow.signal,
      },
    );
    if (!response.ok) throw new Error(`youtube_thumbnail_${response.status}`);
  } finally {
    opened.close();
  }
}
