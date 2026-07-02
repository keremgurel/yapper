import type { FeedbackWord } from "./metrics";

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
): Promise<FeedbackWord[]> {
  const res = await fetch(
    "https://api.deepgram.com/v1/listen?model=nova-3&smart_format=true&punctuate=true",
    {
      method: "POST",
      headers: { Authorization: `Token ${key}`, "Content-Type": "audio/wav" },
      body: audio,
    },
  );
  if (!res.ok) throw new Error(`deepgram_${res.status}`);
  const json = await res.json();
  const words: DeepgramWord[] =
    json?.results?.channels?.[0]?.alternatives?.[0]?.words ?? [];
  return words.map((w) => ({
    text: w.punctuated_word ?? w.word,
    start: w.start,
    end: w.end,
    confidence: w.confidence,
  }));
}
