"use client";

import { useCallback, useRef, useState } from "react";
import type { PublishPlatform } from "@/lib/db/schema";
import type { PlatformCaption } from "@/lib/publish/caption-format";
import { generateCaptions } from "@/lib/publish/client";

import {
  prepareUploadedCaption,
  transcribeCaptionMedia,
} from "./prepare-caption-subject";

import type { CaptionSet } from "./caption-draft";

import type { ContentDetail } from "@/lib/content/client";

/** A video to write captions for. */
export interface CaptionSubject {
  id: string;
  title: string;
  /** Without it the server cannot read the script, and the caption is written
   * from the title alone. Always pass it when the video has a library row. */
  contentItemId?: string;
  mediaKey?: string;
  submissionId?: string;
  transcriptStatus?: string | null;
  sourceCaption?: string;
  videoDescription?: string;
  captionReference?: string;
  noSpeech?: boolean;
  initialCaptions?: CaptionSet;
}

function messageFor(error: unknown): string {
  const reason = error instanceof Error ? error.message : "";
  if (reason === "caption_transcript_failed")
    return "The video could not be transcribed. Your original caption is safe. Retry, describe the video, or write a caption yourself.";
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
    initialCaptions?: CaptionSet,
  ) => void,
  onContentUpdated?: (item: ContentDetail) => void,
) {
  const transcripts = useRef(new Map<string, string>());
  const [reading, setReading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [errorVideoId, setErrorVideoId] = useState<string>();
  const [noSpeech, setNoSpeech] = useState<Record<string, boolean>>({});

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
      setErrorVideoId(subjects[0].id);
      try {
        const drafted = await Promise.all(
          subjects.map(async (subject) => {
            let transcript: string | undefined;
            let silent = subject.noSpeech || noSpeech[subject.id];
            const suppliedContext = Boolean(
              subject.videoDescription?.trim() ||
              subject.captionReference?.trim() ||
              subject.sourceCaption?.trim(),
            );
            if (
              subject.submissionId &&
              subject.contentItemId &&
              subject.transcriptStatus !== "ready" &&
              !suppliedContext &&
              !silent
            ) {
              setReading(true);
              try {
                const updated = await prepareUploadedCaption(
                  subject.contentItemId,
                  subject.submissionId,
                );
                onContentUpdated?.(updated);
                silent = updated.recordedTranscript === "";
              } finally {
                setReading(false);
              }
            }
            if (subject.mediaKey && !suppliedContext && !silent) {
              transcript = transcripts.current.get(subject.mediaKey);
              if (transcript === undefined) {
                setReading(true);
                try {
                  transcript = await transcribeCaptionMedia(subject.mediaKey);
                  transcripts.current.set(subject.mediaKey, transcript);
                } finally {
                  setReading(false);
                }
              }
            }
            silent ||= transcript === "";
            if (silent)
              setNoSpeech((current) => ({ ...current, [subject.id]: true }));
            if (silent && !suppliedContext) return null;
            return {
              initialCaptions: subject.initialCaptions,
              id: subject.id,
              sourceCaption: subject.sourceCaption,
              captions: await generateCaptions({
                title: subject.title,
                platforms,
                contentItemId: subject.contentItemId,
                matchStyle,
                transcript,
                sourceCaption: subject.sourceCaption,
                videoDescription: subject.videoDescription,
                captionReference: subject.captionReference,
                requireTranscript:
                  Boolean(subject.mediaKey) && !suppliedContext && !silent,
                titleOnly,
                instructions,
              }),
            };
          }),
        );
        for (const result of drafted) {
          if (result)
            onCaptions(
              result.id,
              result.captions,
              titleOnly,
              result.sourceCaption,
              result.initialCaptions,
            );
        }
      } catch (cause) {
        setError(messageFor(cause));
      } finally {
        setGenerating(false);
      }
    },
    [onCaptions, onContentUpdated, noSpeech],
  );

  return { generating, reading, error, errorVideoId, noSpeech, generate };
}
