"use client";

import { useCallback, useState } from "react";
import { useStudio } from "@/components/studio/studio-context";
import { mentionedNames } from "@/lib/studio/mentions";
import { keptWords, placementsToSpans } from "@/lib/studio/overlay-plan";
import { placeOverlaysRemote } from "@/lib/studio/place-overlays";

export type PlacementStatus = "idle" | "thinking" | "done" | "error";

export interface PlacementResult {
  placed: number;
  /** One line per cutaway that landed, for the user to read back. */
  notes: string[];
}

/**
 * Ask the AI where the mentioned media belongs, and put it there.
 *
 * The model only ever returns quotes. Those are aligned against the transcript
 * here, and anything it invented — a file that doesn't exist, words nobody
 * said — is dropped before the timeline hears about it.
 */
export function useOverlayPlacement() {
  const { words, clips, mediaAssets, placeOverlays } = useStudio();
  const [status, setStatus] = useState<PlacementStatus>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [result, setResult] = useState<PlacementResult | null>(null);

  const run = useCallback(
    async (instruction: string) => {
      setStatus("thinking");
      setMessage(null);
      setResult(null);
      // Mentioning nothing means "use what I have", not "use nothing".
      const named = mentionedNames(
        instruction,
        mediaAssets.map((m) => m.name),
      );
      const files = named.length
        ? mediaAssets.filter((m) => named.includes(m.name))
        : mediaAssets;

      // The model only ever sees what survives the edit, so it cannot quote a
      // take that was cut and land a cutaway on the cut point.
      const heard = keptWords(words, clips);
      try {
        const placements = await placeOverlaysRemote(instruction, heard, files);
        if (placements === null) {
          setStatus("error");
          setMessage("The AI editor is not configured on this server.");
          return;
        }
        const spans = placementsToSpans(
          heard,
          placements,
          files.map((f) => f.name),
        );
        const landed = placeOverlays(spans);
        setStatus("done");
        setResult({
          placed: landed.length,
          notes: landed.map((s) => `${s.file}: ${s.reason ?? "placed"}`),
        });
        if (landed.length === 0) {
          setMessage(
            "Nothing in the transcript matched. Try naming the moment.",
          );
        }
      } catch {
        setStatus("error");
        setMessage("The AI editor could not be reached.");
      }
    },
    [words, clips, mediaAssets, placeOverlays],
  );

  const reset = useCallback(() => {
    setStatus("idle");
    setMessage(null);
    setResult(null);
  }, []);

  return { status, message, result, run, reset };
}
