"use client";

import { useCallback, useRef, useState } from "react";
import type { PublishPlatform } from "@/lib/db/schema";
import type { PlatformCaption } from "@/lib/publish/caption";
import { generateCaptions } from "@/lib/publish/client";

import { transcribeCaptionMedia } from "./prepare-caption-subject";

/** A video to write captions for. */
export interface CaptionSubject {
  id: string;
  title: string;
  /** Without it the server cannot read the script, and the caption is written
   * from the title alone. Always pass it when the video has a library row. */
  contentItemId?: string;
  mediaKey?: string;
  sourceCaption?: string;
}

function messageFor(error: unknown): string {
  const reason = error instanceof Error ? error.message : "";
  if (reason === "caption_transcript_failed")
    return "The video could not be transcribed. Your original caption is safe. Try again before generating.";
  if (reason === "no_provider") return "AI captions aren't set up yet.";
  return "Caption generation failed. Your existing text is safe.";
}

/**
 * Drafting captions for one or many videos. One concern: the request and its
 * status. Where the results are stored is the caller's business, which is why
 * they arrive through `onCaptions` rather than being held here.
 */
export function useCaptionGeneration(
  onCaptions: (
    videoId: string,
    captions: PlatformCaption[],
    titleOnly?: boolean,
    sourceCaption?: string,
  ) => void,
) {
  const transcripts = useRef(new Map<string, string>());
  const [reading, setReading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  const generate = useCallback(
    async (
      subjects: CaptionSubject[],
      platforms: PublishPlatform[],
      matchStyle: boolean,
      instructions?: string,
      titleOnly = false,
    ) => {
      if (!subjects.length || !platforms.length) return;
      setGenerating(true);
      setError("");
      try {
        const drafted = await Promise.all(
          subjects.map(async (subject) => {
            let transcript: string | undefined;
            if (subject.mediaKey) {
              transcript = transcripts.current.get(subject.mediaKey);
              if (!transcript) {
                setReading(true);
                try {
                  transcript = await transcribeCaptionMedia(subject.mediaKey);
                  transcripts.current.set(subject.mediaKey, transcript);
                } finally {
                  setReading(false);
                }
              }
            }
            return {
              id: subject.id,
              sourceCaption: subject.sourceCaption,
              captions: await generateCaptions({
                title: subject.title,
                platforms,
                contentItemId: subject.contentItemId,
                matchStyle,
                transcript,
                sourceCaption: subject.sourceCaption,
                requireTranscript: Boolean(subject.mediaKey),
                titleOnly,
                instructions,
              }),
            };
          }),
        );
        for (const { id, captions, sourceCaption } of drafted)
          onCaptions(id, captions, titleOnly, sourceCaption);
      } catch (cause) {
        setError(messageFor(cause));
      } finally {
        setGenerating(false);
      }
    },
    [onCaptions],
  );

  return { generating, reading, error, generate };
}
