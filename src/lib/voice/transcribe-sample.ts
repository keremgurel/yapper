import { viaDeepgramURL } from "@/lib/transcription/providers";

const TIMEOUT_MS = 120_000;

export interface SampleTranscript {
  transcript: string;
  /** Seconds of audio the transcriber actually heard. What the sample is
   * billed on when the platform did not report a length. */
  heardSec: number;
}

/**
 * Transcribes a published video from its media URL.
 *
 * Deepgram fetches the file itself, so nothing streams through this function
 * and a long video does not hit the request body limit.
 */
export async function transcribeSampleMedia(
  mediaUrl: string,
  signal?: AbortSignal,
): Promise<SampleTranscript> {
  const key = process.env.DEEPGRAM_API_KEY;
  if (!key) throw new Error("no_transcription_provider");
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  signal?.addEventListener("abort", onAbort, { once: true });
  try {
    const result = await viaDeepgramURL(
      mediaUrl,
      key,
      [],
      controller.signal,
      TIMEOUT_MS,
    );
    const transcript = result.words
      .map((word) => word.text.trim())
      .filter(Boolean)
      .join(" ");
    if (!transcript) throw new Error("empty_transcript");
    return { transcript, heardSec: result.heardSec };
  } finally {
    signal?.removeEventListener("abort", onAbort);
  }
}
