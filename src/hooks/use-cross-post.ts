"use client";

import { useCallback, useState } from "react";
import {
  crossPostToYouTube,
  type CrossPostInput,
  type CrossPostResult,
} from "@/lib/publish/client";

export type CrossPostState = "idle" | "posting" | "done" | "error";
export type CrossPostError = "not_connected" | "failed";

/** Post one master video to YouTube: the state machine behind the compose sheet. */
export function useCrossPost() {
  const [state, setState] = useState<CrossPostState>("idle");
  const [error, setError] = useState<CrossPostError | null>(null);
  const [result, setResult] = useState<CrossPostResult | null>(null);

  const post = useCallback(async (input: CrossPostInput) => {
    setState("posting");
    setError(null);
    try {
      setResult(await crossPostToYouTube(input));
      setState("done");
    } catch (e) {
      setError(
        e instanceof Error && e.message === "not_connected"
          ? "not_connected"
          : "failed",
      );
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
