import { coachDelivery, type Coaching } from "./coach";
import {
  computeMetrics,
  type DeliveryMetrics,
  type FeedbackWord,
} from "./metrics";
import { transcribeForFeedback } from "./transcribe";

export interface AudioFeedback {
  transcript: string;
  words: FeedbackWord[];
  metrics: DeliveryMetrics;
  coaching: Coaching;
}

/**
 * Full audio-feedback pipeline: transcribe (Deepgram, with confidence) →
 * deterministic metrics (free) → LLM coaching pass. Throws "no_speech" if the
 * clip has no words so the caller can refund the credit.
 */
export async function runAudioFeedback(
  audio: ArrayBuffer,
): Promise<AudioFeedback> {
  const deepgramKey = process.env.DEEPGRAM_API_KEY;
  if (!deepgramKey) throw new Error("no_provider");

  const words = await transcribeForFeedback(audio, deepgramKey);
  if (words.length === 0) throw new Error("no_speech");

  const transcript = words.map((w) => w.text).join(" ");
  const metrics = computeMetrics(words);
  const coaching = await coachDelivery(transcript, metrics);

  return { transcript, words, metrics, coaching };
}
