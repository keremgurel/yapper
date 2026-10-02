"use client";

import { useCallback, useState } from "react";

import {
  savePronunciation,
  scorePronunciation,
} from "@/lib/pronunciation/client";
import type {
  TrainingContext,
  TrainingFeedbackResponse,
} from "@/lib/training-feedback/types";

/** How long to hold the report for pronunciation scores once coaching is back.
 * Past this the report opens without them. */
const PRONUNCIATION_GRACE_MS = 15_000;

export type TrainingFeedbackState = "idle" | "running" | "error";

/** Error codes the CTA turns into copy. Anything unrecognised becomes
 * "unknown", so a new server code degrades to a generic message instead of
 * rendering a raw string at the user. */
export type TrainingFeedbackError =
  | "unauthorized"
  | "not_entitled"
  | "insufficient_credits"
  | "too_short"
  | "rate_limited"
  | "fair_use_limit"
  | "no_provider"
  | "unknown";

const KNOWN_ERRORS = new Set<string>([
  "unauthorized",
  "not_entitled",
  "insufficient_credits",
  "too_short",
  "no_provider",
  "fair_use_limit",
]);

function toError(status: number, code: unknown): TrainingFeedbackError {
  if (typeof code === "string" && KNOWN_ERRORS.has(code)) {
    return code as TrainingFeedbackError;
  }
  if (status === 429 || status === 503) return "rate_limited";
  return "unknown";
}

/**
 * Sends one practice rep for coaching. Owns only the request: the caller
 * decides what to do with the finished submission, which for the practice
 * pages means routing to its report.
 */
export function useTrainingFeedback() {
  const [state, setState] = useState<TrainingFeedbackState>("idle");
  const [error, setError] = useState<TrainingFeedbackError | null>(null);

  const reset = useCallback(() => {
    setState("idle");
    setError(null);
  }, []);

  const run = useCallback(
    async (
      audio: Blob,
      context: TrainingContext,
    ): Promise<TrainingFeedbackResponse | null> => {
      setState("running");
      setError(null);

      const form = new FormData();
      // The filename matters: some providers pick a demuxer partly from the
      // extension, so it is derived from the blob's own type.
      const extension = audio.type.includes("mp4") ? "m4a" : "webm";
      form.append("audio", audio, `rep.${extension}`);
      form.append("context", JSON.stringify(context));

      // Scored in the browser while the coaching request runs, so it usually
      // adds no wait. It never fails the rep.
      const pronunciation = scorePronunciation(audio);

      try {
        const response = await fetch("/api/training/feedback", {
          method: "POST",
          body: form,
        });
        if (!response.ok) {
          const body = (await response.json().catch(() => ({}))) as {
            error?: unknown;
          };
          setError(toError(response.status, body.error));
          setState("error");
          return null;
        }
        const result = (await response.json()) as TrainingFeedbackResponse;
        const report = await Promise.race([
          pronunciation,
          new Promise<null>((resolve) =>
            setTimeout(() => resolve(null), PRONUNCIATION_GRACE_MS),
          ),
        ]);
        if (report) await savePronunciation(result.submissionId, report);
        setState("idle");
        return result;
      } catch {
        setError("unknown");
        setState("error");
        return null;
      }
    },
    [],
  );

  return { state, error, run, reset };
}
