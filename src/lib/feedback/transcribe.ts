import type { FeedbackWord } from "./metrics";
import { fetchBoundedJson } from "@/lib/http/outbound";

const MAX_DEEPGRAM_RESPONSE_BYTES = 2 * 1024 * 1024;

interface DeepgramWord {
  word: string;
  start: number;
  end: number;
  confidence?: number;
  punctuated_word?: string;
}

/**
 * Transcribe audio for feedback via Deepgram Nova-3, keeping per-word confidence
 * (the editor's /api/transcribe drops it; the clarity metric needs it). Server-
 * side so web and a future native client hit the same authoritative path.
 */
export async function transcribeForFeedback(
  audio: ArrayBuffer,
  key: string,
  signal: AbortSignal,
  timeoutMs: number,
): Promise<FeedbackWord[]> {
  const { response, data } = await fetchBoundedJson<{
    results?: {
      channels?: { alternatives?: { words?: DeepgramWord[] }[] }[];
    };
  }>(
    "https://api.deepgram.com/v1/listen?model=nova-3&smart_format=true&punctuate=true",
    {
      method: "POST",
      headers: { Authorization: `Token ${key}`, "Content-Type": "audio/wav" },
      body: audio,
      signal,
    },
    {
      timeoutMs,
      maxBytes: MAX_DEEPGRAM_RESPONSE_BYTES,
      signal,
    },
  );
  if (!response.ok) throw new Error(`deepgram_${response.status}`);
  const words: DeepgramWord[] =
    data.results?.channels?.[0]?.alternatives?.[0]?.words ?? [];
  return words.map((w) => ({
    text: w.punctuated_word ?? w.word,
    start: w.start,
    end: w.end,
    confidence: w.confidence,
  }));
}
