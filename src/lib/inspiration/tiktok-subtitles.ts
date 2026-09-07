import { vttToText } from "@/lib/inspiration/vtt";

const MAX_BYTES = 512 * 1024;
const TIMEOUT_MS = 15_000;

/** TikTok's own captions for a video, as plain text, or null when the link
 * does not answer. Never throws: captions are the cheap first try, and a miss
 * falls through to transcription. */
export async function fetchTikTokSubtitles(
  url: string,
  signal?: AbortSignal,
): Promise<string | null> {
  try {
    const res = await fetch(url, {
      signal: signal ?? AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const length = Number(res.headers.get("content-length") ?? 0);
    if (length > MAX_BYTES) return null;
    const body = (await res.text()).slice(0, MAX_BYTES);
    const text = vttToText(body);
    return text.length >= 20 ? text : null;
  } catch {
    return null;
  }
}
