/**
 * The download file extension for a recorded take, derived from the recording
 * blob's MIME type. Recording falls back to MP4 on browsers without WebM
 * capture support (Safari), so a fixed ".webm" name would mislabel those files
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
