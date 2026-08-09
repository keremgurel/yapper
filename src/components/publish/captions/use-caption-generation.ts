"use client";

import { useCallback, useState } from "react";
import type { PublishPlatform } from "@/lib/db/schema";
import type { PlatformCaption } from "@/lib/publish/caption";
import { generateCaptions } from "@/lib/publish/client";

/** A video to write captions for. */
export interface CaptionSubject {
  id: string;
  title: string;
  /** Without it the server cannot read the script, and the caption is written
   * from the title alone. Always pass it when the video has a library row. */
  contentItemId?: string;
}

function messageFor(error: unknown): string {
  const reason = error instanceof Error ? error.message : "";
  if (reason === "no_provider") return "AI captions aren't set up yet.";
  return "Caption generation failed. Your existing text is safe.";
}

/**
 * Drafting captions for one or many videos. One concern: the request and its
 * status. Where the results are stored is the caller's business, which is why
 * they arrive through `onCaptions` rather than being held here.
 */
export function useCaptionGeneration(
  onCaptions: (videoId: string, captions: PlatformCaption[]) => void,
) {
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  const generate = useCallback(
    async (
      subjects: CaptionSubject[],
      platforms: PublishPlatform[],
      matchStyle: boolean,
    ) => {
      if (!subjects.length || !platforms.length) return;
      setGenerating(true);
      setError("");
      try {
        const drafted = await Promise.all(
          subjects.map(async (subject) => ({
            id: subject.id,
            captions: await generateCaptions({
              title: subject.title,
              platforms,
              contentItemId: subject.contentItemId,
              matchStyle,
            }),
          })),
        );
        for (const { id, captions } of drafted) onCaptions(id, captions);
      } catch (cause) {
        setError(messageFor(cause));
      } finally {
        setGenerating(false);
      }
    },
    [onCaptions],
  );

  return { generating, error, generate };
}
