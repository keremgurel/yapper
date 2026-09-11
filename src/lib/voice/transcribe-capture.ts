import {
  captureMediaType,
  VOICE_CAPTURE_DIRECT_UPLOAD_BYTES,
} from "./capture-media";

/** Large takes bypass the function's request-body limit via temporary storage. */
export async function transcribeVoiceCapture(
  blob: Blob,
  signal: AbortSignal,
): Promise<string> {
  const contentType = captureMediaType(blob.type || "audio/webm");
  if (!contentType) throw new Error("unsupported_audio_type");
  let body: BodyInit = blob;
  let requestType = contentType;

  if (blob.size > VOICE_CAPTURE_DIRECT_UPLOAD_BYTES) {
    const ticketResponse = await fetch("/api/transcribe/upload-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bytes: blob.size, contentType }),
      signal,
    });
    if (!ticketResponse.ok) throw new Error("audio_upload_failed");
    const ticket = (await ticketResponse.json()) as {
      key: string;
      url: string;
    };
    const uploaded = await fetch(ticket.url, {
      method: "PUT",
      headers: { "Content-Type": contentType },
      body: blob,
      signal,
    });
    if (!uploaded.ok) throw new Error("audio_upload_failed");
    body = JSON.stringify({ key: ticket.key, contentType });
    requestType = "application/json";
  }

  const response = await fetch("/api/transcribe", {
    method: "POST",
    headers: { "Content-Type": requestType },
    body,
    signal,
  });
  if (!response.ok) throw new Error("transcribe_failed");
  const data = (await response.json()) as { words?: { text: string }[] };
  return (data.words ?? [])
    .map((word) => word.text)
    .join(" ")
    .trim();
}
