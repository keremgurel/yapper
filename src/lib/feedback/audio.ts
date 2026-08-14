import { coachDelivery, type Coaching } from "./coach";
import {
  computeMetrics,
  type DeliveryMetrics,
  type FeedbackWord,
} from "./metrics";
import { transcribeForFeedback } from "./transcribe";
import { type FeedbackWorkflow, remainingFeedbackMs } from "./workflow";

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
  workflow: FeedbackWorkflow,
): Promise<AudioFeedback> {
  const deepgramKey = process.env.DEEPGRAM_API_KEY;
  if (!deepgramKey) throw new Error("no_provider");

  const words = await transcribeForFeedback(
    audio,
    deepgramKey,
    workflow.signal,
    remainingFeedbackMs(workflow, 60_000),
  );
  if (words.length === 0) throw new Error("no_speech");

  const transcript = words.map((w) => w.text).join(" ");
  const metrics = computeMetrics(words);
  remainingFeedbackMs(workflow);
  const coaching = await coachDelivery(transcript, metrics, workflow.signal);
  remainingFeedbackMs(workflow);

  return { transcript, words, metrics, coaching };
}
