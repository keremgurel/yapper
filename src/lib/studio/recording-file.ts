/**
 * The download file extension for a recorded take, derived from the recording
 * blob's MIME type. MP4 is preferred for native editing, with WebM as a browser
 * fallback, so a fixed ".webm" name would mislabel those files
 * and confuse the OS about how to open them. Anything that is not an MP4-family
 * container is treated as WebM, matching what MediaRecorder can actually emit.
 */
export function recordingExtension(mimeType: string): string {
  const subtype = mimeType.split("/")[1]?.split(";")[0]?.trim().toLowerCase();
  if (subtype === "mp4" || subtype === "quicktime") return "mp4";
  return "webm";
}

/** A timestamped download filename for a recording, with the right extension
 * for its container. `stamp` is an ISO-ish label (no extension). */
export function recordingFileName(stamp: string, mimeType: string): string {
  return `${stamp}.${recordingExtension(mimeType)}`;
}

/** Prefer an MP4 that the native editor can read, then browser fallbacks. */
export function recordingMimeType(
  isSupported: (mimeType: string) => boolean,
): string | undefined {
  return [
    "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
    "video/mp4",
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ].find(isSupported);
}
