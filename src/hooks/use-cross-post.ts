"use client";

import { useCallback, useRef, useState } from "react";
import type { CrossPostResult } from "@/lib/publish/client";
import { PublishAttempt } from "@/lib/publish/attempt";

export type CrossPostState = "idle" | "posting" | "done" | "error";
export type CrossPostError =
  | "not_connected"
  | "not_professional"
  | "in_progress"
  | "attempt_failed"
  | "failed";

function toError(e: unknown): CrossPostError {
  const m = e instanceof Error ? e.message : "";
  if (m === "not_connected") return "not_connected";
  if (m === "not_professional") return "not_professional";
  if (m === "publish_in_progress") return "in_progress";
  if (m === "publish_attempt_failed") return "attempt_failed";
  return "failed";
}

/** Shared state machine for the active per-platform publish forms. */
export function useCrossPost() {
  const [state, setState] = useState<CrossPostState>("idle");
  const [error, setError] = useState<CrossPostError | null>(null);
  const [result, setResult] = useState<CrossPostResult | null>(null);
  const attempt = useRef<PublishAttempt | null>(null);
  attempt.current ??= new PublishAttempt();

  const post = useCallback(
    async (run: (idempotencyKey: string) => Promise<CrossPostResult>) => {
      const idempotencyKey = attempt.current?.begin();
      if (!idempotencyKey) return;
      setState("posting");
      setError(null);
      try {
        setResult(await run(idempotencyKey));
        setState("done");
      } catch (e) {
        setError(toError(e));
        setState("error");
      } finally {
        attempt.current?.finish();
      }
    },
    [],
  );

  const reset = useCallback(() => {
    setState("idle");
    setError(null);
    setResult(null);
    attempt.current?.reset();
  }, []);

  return { state, error, result, post, reset };
}
