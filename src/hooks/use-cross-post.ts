"use client";

import { useCallback, useState } from "react";
import type { CrossPostResult } from "@/lib/publish/client";

export type CrossPostState = "idle" | "posting" | "done" | "error";
export type CrossPostError = "not_connected" | "not_professional" | "failed";

function toError(e: unknown): CrossPostError {
  const m = e instanceof Error ? e.message : "";
  if (m === "not_connected") return "not_connected";
  if (m === "not_professional") return "not_professional";
  return "failed";
}

/**
 * The post state machine behind a compose body. Platform-agnostic: the caller
 * passes a thunk that performs the actual post (crossPostToYouTube,
 * crossPostToInstagram, ...), so each per-platform body reuses this without
 * this hook knowing any platform specifics.
 */
export function useCrossPost() {
  const [state, setState] = useState<CrossPostState>("idle");
  const [error, setError] = useState<CrossPostError | null>(null);
  const [result, setResult] = useState<CrossPostResult | null>(null);

  const post = useCallback(async (run: () => Promise<CrossPostResult>) => {
    setState("posting");
    setError(null);
    try {
      setResult(await run());
      setState("done");
    } catch (e) {
      setError(toError(e));
      setState("error");
    }
  }, []);

  const reset = useCallback(() => {
    setState("idle");
    setError(null);
    setResult(null);
  }, []);

  return { state, error, result, post, reset };
}
