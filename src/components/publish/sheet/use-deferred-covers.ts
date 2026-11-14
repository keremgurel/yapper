"use client";

import { useCallback, useState } from "react";
import type { SourceOutcome } from "./outcome-rows";

/**
 * YouTube covers that are set after the post is already reported live. Each
 * video's answer is kept here and folded into its YouTube outcome when it
 * arrives, so a late cover never holds up or rewrites the publish itself.
 */
export function useDeferredCovers() {
  const [applied, setApplied] = useState<Record<string, boolean>>({});

  const track = useCallback((sourceId: string, result: Promise<boolean>) => {
    void result.then((ok) => setApplied((all) => ({ ...all, [sourceId]: ok })));
  }, []);

  const settle = useCallback(
    (outcomes: SourceOutcome[]): SourceOutcome[] =>
      outcomes.map((outcome) =>
        outcome.platform === "youtube" &&
        outcome.coverPending &&
        outcome.sourceId in applied
          ? {
              ...outcome,
              coverPending: false,
              coverApplied: applied[outcome.sourceId],
            }
          : outcome,
      ),
    [applied],
  );

  return { track, settle };
}
