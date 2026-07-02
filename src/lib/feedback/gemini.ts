const BASE = "https://generativelanguage.googleapis.com/v1beta";
const UPLOAD_BASE = "https://generativelanguage.googleapis.com/upload/v1beta";

function key(): string {
  const k = process.env.GEMINI_API_KEY;
  if (!k) throw new Error("no_provider");
  return k;
}

/** The model for video understanding (alias resolves to the latest flash). */
export const VIDEO_MODEL =
  process.env.GEMINI_VIDEO_MODEL ?? "gemini-flash-latest";

/**
 * Start a resumable upload session and return the client-usable upload URL.
 * The client PUTs the bytes to this URL directly (no API key needed on that
 * request), so large videos never pass through our serverless function.
 */
export async function startResumableUpload(
  sizeBytes: number,
  mimeType: string,
): Promise<string> {
  const res = await fetch(`${UPLOAD_BASE}/files`, {
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
  });
  if (!res.ok) throw new Error(`gemini_upload_start_${res.status}`);
  const url = res.headers.get("x-goog-upload-url");
  if (!url) throw new Error("gemini_no_upload_url");
  return url;
}

/**
 * Server-side upload of raw bytes to the Gemini Files API. Starts a resumable
 * session, PUTs the bytes, and polls until the file is ACTIVE (video needs
 * processing). Returns the file uri to reference in generateContent.
 */
export async function uploadBytesToGemini(
  bytes: ArrayBuffer,
  mimeType: string,
): Promise<string> {
  const uploadUrl = await startResumableUpload(bytes.byteLength, mimeType);
  const put = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      "Content-Length": String(bytes.byteLength),
      "X-Goog-Upload-Offset": "0",
      "X-Goog-Upload-Command": "upload, finalize",
    },
    body: bytes,
  });
  if (!put.ok) throw new Error(`gemini_upload_${put.status}`);
  const file = (await put.json())?.file as
    | { name?: string; uri?: string; state?: string }
    | undefined;
  if (!file?.uri || !file.name) throw new Error("gemini_upload_no_uri");

  // Wait for processing (videos start as PROCESSING). ~45s worst case, well
  // inside maxDuration. A non-OK poll is treated as transient (retry), not as
  // "done" — so a 429/401 can't sneak a PROCESSING file through to generate.
  let state = file.state;
  for (let i = 0; i < 30 && state !== "ACTIVE"; i++) {
    await new Promise((r) => setTimeout(r, 1500));
    const res = await fetch(`${BASE}/${file.name}`, {
      headers: { "X-goog-api-key": key() },
    });
    if (!res.ok) continue;
    const j = await res.json();
    state = j?.state;
    if (state === "FAILED") throw new Error("gemini_file_failed");
  }
  if (state !== "ACTIVE") throw new Error("gemini_processing_timeout");
  return file.uri;
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
  model = VIDEO_MODEL,
): Promise<string> {
  const res = await fetch(`${BASE}/models/${model}:generateContent`, {
    method: "POST",
    headers: { "X-goog-api-key": key(), "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts }],
      generationConfig: {
        temperature: 0.4,
        responseMimeType: "application/json",
      },
    }),
  });
  if (!res.ok) throw new Error(`gemini_${res.status}`);
  const json = await res.json();
  const out = json?.candidates?.[0]?.content?.parts
    ?.map((p: { text?: string }) => p.text ?? "")
    .join("");
  return typeof out === "string" ? out : "";
}
