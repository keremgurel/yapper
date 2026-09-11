export const VOICE_CAPTURE_DIRECT_UPLOAD_BYTES = 3_900_000;

const CAPTURE_MEDIA_TYPES = [
  "audio/webm",
  "audio/mp4",
  "audio/ogg",
  "audio/wav",
  "audio/aac",
  "audio/mpeg",
];

/** Strip codec parameters so upload signatures and provider MIME types agree. */
export function captureMediaType(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const type = value.split(";")[0]!.trim().toLowerCase();
  return CAPTURE_MEDIA_TYPES.includes(type) ? type : null;
}
