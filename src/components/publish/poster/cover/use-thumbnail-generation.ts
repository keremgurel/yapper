"use client";

import { useCallback, useState } from "react";

/** One call to the thumbnail route; the caller decides what to do with the image. */
export function useThumbnailGeneration() {
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  const generate = useCallback(
    async (input: {
      prompt: string;
      frame?: string;
      reference?: string;
    }): Promise<string | null> => {
      setGenerating(true);
      setError("");
      try {
        const response = await fetch("/api/publish/thumbnail", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        });
        const result = (await response.json().catch(() => ({}))) as {
          image?: string;
          error?: string;
        };
        if (!response.ok || !result.image) {
          setError(
            result.error === "insufficient_credits"
              ? "You are out of credits for this month."
              : result.error === "not_entitled"
                ? "AI thumbnails need an active membership."
                : "The thumbnail could not be generated. Try again.",
          );
          return null;
        }
        return result.image;
      } catch {
        setError("The thumbnail could not be generated. Try again.");
        return null;
      } finally {
        setGenerating(false);
      }
    },
    [],
  );

  return { generating, error, generate };
}
