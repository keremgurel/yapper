"use client";

import { useState } from "react";
import { decodeToMono16k } from "@/lib/studio/audio-decode";
import { encodeWav } from "@/lib/studio/wav";
import type { Coaching } from "@/lib/feedback/coach";
import type { DeliveryMetrics } from "@/lib/feedback/metrics";

export interface AudioFeedbackData {
  submissionId: string;
  balance: number;
  transcript: string;
  metrics: DeliveryMetrics;
  coaching: Coaching;
}

export type FeedbackStatus =
  | "idle"
  | "preparing"
  | "analyzing"
  | "done"
  | "error";

export type FeedbackError =
  | "insufficient_credits"
  | "no_speech"
  | "failed"
  | null;

/**
 * Runs the audio-feedback request: decode the source audio in-browser → 16 kHz
 * WAV → POST to /api/feedback. Keeps the server as the source of truth; the
 * client just prepares the audio and renders the result.
 */
export function useAudioFeedback(sourceUrl?: string) {
  const [status, setStatus] = useState<FeedbackStatus>("idle");
  const [data, setData] = useState<AudioFeedbackData | null>(null);
  const [error, setError] = useState<FeedbackError>(null);

  const run = async () => {
    if (!sourceUrl) return;
    setStatus("preparing");
    setError(null);
    try {
      const audio = await decodeToMono16k(sourceUrl);
      const wav = encodeWav(audio, 16000);
      setStatus("analyzing");
      const res = await fetch("/api/feedback?tier=audio", {
        method: "POST",
        headers: { "Content-Type": "audio/wav" },
        body: wav,
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        setData(json as AudioFeedbackData);
        setStatus("done");
        return;
      }
      setStatus("error");
      if (res.status === 402) setError("insufficient_credits");
      else if (json?.detail === "no_speech") setError("no_speech");
      else setError("failed");
    } catch {
      setStatus("error");
      setError("failed");
    }
  };

  const reset = () => {
    setStatus("idle");
    setData(null);
    setError(null);
  };

  return { status, data, error, run, reset };
}
