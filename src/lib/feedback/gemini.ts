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
