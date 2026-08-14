import { createReadStream } from "node:fs";
import { Readable } from "node:stream";
import { fetchBoundedJson, fetchBoundedResponse } from "@/lib/http/outbound";
import { type FeedbackWorkflow, remainingFeedbackMs } from "./workflow";

const BASE = "https://generativelanguage.googleapis.com/v1beta";
const UPLOAD_BASE = "https://generativelanguage.googleapis.com/upload/v1beta";
const MAX_CONTROL_RESPONSE_BYTES = 512 * 1024;
const MAX_GENERATE_RESPONSE_BYTES = 1024 * 1024;
const MAX_OUTPUT_TOKENS = 2_000;

function key(): string {
  const k = process.env.GEMINI_API_KEY;
  if (!k) throw new Error("no_provider");
  return k;
}

/** The model for video understanding (alias resolves to the latest flash). */
export const VIDEO_MODEL =
  process.env.GEMINI_VIDEO_MODEL ?? "gemini-flash-latest";

/**
 * Start a resumable upload session for a bounded server-side file stream.
 */
export async function startResumableUpload(
  sizeBytes: number,
  mimeType: string,
  workflow: FeedbackWorkflow,
): Promise<string> {
  const { response } = await fetchBoundedResponse(
    `${UPLOAD_BASE}/files`,
    {
      method: "POST",
      headers: {
        "X-goog-api-key": key(),
        "X-Goog-Upload-Protocol": "resumable",
        "X-Goog-Upload-Command": "start",
        "X-Goog-Upload-Header-Content-Length": String(sizeBytes),
        "X-Goog-Upload-Header-Content-Type": mimeType,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ file: { display_name: "yapper-take" } }),
    },
    {
      timeoutMs: remainingFeedbackMs(workflow, 20_000),
      maxBytes: MAX_CONTROL_RESPONSE_BYTES,
      signal: workflow.signal,
    },
  );
  if (!response.ok) {
    throw new Error(`gemini_upload_start_${response.status}`);
  }
  const url = response.headers.get("x-goog-upload-url");
  if (!url) throw new Error("gemini_no_upload_url");
  return url;
}

/**
 * Server-side streaming upload to the Gemini Files API. Starts a resumable
 * session, streams the owned temporary file, and polls until the file is ACTIVE
 * (video needs processing). Returns the URI used by generateContent.
 */
export async function uploadFileToGemini(
  filePath: string,
  byteLength: number,
  mimeType: string,
  workflow: FeedbackWorkflow,
): Promise<string> {
  const uploadUrl = await startResumableUpload(byteLength, mimeType, workflow);
  const stream = createReadStream(filePath);
  const abort = () => stream.destroy(new DOMException("aborted", "AbortError"));
  workflow.signal.addEventListener("abort", abort, { once: true });
  let upload: {
    response: Response;
    data: { file?: { name?: string; uri?: string; state?: string } };
  };
  try {
    upload = await fetchBoundedJson(
      uploadUrl,
      {
        method: "POST",
        headers: {
          "Content-Length": String(byteLength),
          "X-Goog-Upload-Offset": "0",
          "X-Goog-Upload-Command": "upload, finalize",
        },
        body: Readable.toWeb(stream) as unknown as BodyInit,
        duplex: "half",
      } as RequestInit & { duplex: "half" },
      {
        timeoutMs: remainingFeedbackMs(workflow, 180_000),
        maxBytes: MAX_CONTROL_RESPONSE_BYTES,
        signal: workflow.signal,
      },
    );
  } finally {
    workflow.signal.removeEventListener("abort", abort);
    stream.destroy();
  }
  if (!upload.response.ok) {
    throw new Error(`gemini_upload_${upload.response.status}`);
  }
  const file = upload.data.file as
    | { name?: string; uri?: string; state?: string }
    | undefined;
  if (!file?.uri || !file.name) throw new Error("gemini_upload_no_uri");

  // Wait for processing (videos start as PROCESSING). ~45s worst case, well
  // inside maxDuration. A non-OK poll is treated as transient (retry), not as
  // "done" — so a 429/401 can't sneak a PROCESSING file through to generate.
  let state = file.state;
  for (let i = 0; i < 30 && state !== "ACTIVE"; i++) {
    await sleep(1_500, workflow);
    const { response, data } = await fetchBoundedJson<{ state?: unknown }>(
      `${BASE}/${file.name}`,
      { headers: { "X-goog-api-key": key() } },
      {
        timeoutMs: remainingFeedbackMs(workflow, 15_000),
        maxBytes: MAX_CONTROL_RESPONSE_BYTES,
        signal: workflow.signal,
      },
    );
    if (!response.ok) {
      if (response.status === 429 || response.status >= 500) continue;
      throw new Error(`gemini_file_${response.status}`);
    }
    state = typeof data.state === "string" ? data.state : undefined;
    if (state === "FAILED") throw new Error("gemini_file_failed");
  }
  if (state !== "ACTIVE") throw new Error("gemini_processing_timeout");
  remainingFeedbackMs(workflow);
  return file.uri;
}

async function sleep(ms: number, workflow: FeedbackWorkflow): Promise<void> {
  const delay = Math.min(ms, remainingFeedbackMs(workflow));
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(done, delay);
    const abort = () =>
      done(workflow.signal.reason ?? new DOMException("aborted", "AbortError"));
    function done(error?: unknown) {
      clearTimeout(timer);
      workflow.signal.removeEventListener("abort", abort);
      if (error !== undefined) reject(error);
      else resolve();
    }
    workflow.signal.addEventListener("abort", abort, { once: true });
    if (workflow.signal.aborted) abort();
  });
  remainingFeedbackMs(workflow);
}

interface GeminiPart {
  text?: string;
  fileData?: { mimeType: string; fileUri: string };
}

/**
 * Call generateContent with the given parts and return the model's text.
 * `system` is sent as a systemInstruction. Throws on non-200.
 */
export async function geminiGenerate(
  parts: GeminiPart[],
  system: string,
  workflow: FeedbackWorkflow,
  model = VIDEO_MODEL,
): Promise<string> {
  const { response, data } = await fetchBoundedJson<{
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  }>(
    `${BASE}/models/${model}:generateContent`,
    {
      method: "POST",
      headers: {
        "X-goog-api-key": key(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts }],
        generationConfig: {
          temperature: 0.4,
          responseMimeType: "application/json",
          maxOutputTokens: MAX_OUTPUT_TOKENS,
        },
      }),
    },
    {
      timeoutMs: remainingFeedbackMs(workflow, 60_000),
      maxBytes: MAX_GENERATE_RESPONSE_BYTES,
      signal: workflow.signal,
    },
  );
  if (!response.ok) throw new Error(`gemini_${response.status}`);
  remainingFeedbackMs(workflow);
  const out = data.candidates?.[0]?.content?.parts
    ?.map((p: { text?: string }) => p.text ?? "")
    .join("");
  return typeof out === "string" ? out : "";
}
