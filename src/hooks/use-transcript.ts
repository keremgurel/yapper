"use client";

import { useCallback, useState } from "react";
import { decodeToMono16k } from "@/lib/studio/audio-decode";
import { transcribeToWords } from "@/lib/studio/transcribe";
import type { Word } from "@/lib/studio/types";

export type TranscribeStatus = "idle" | "transcribing" | "done" | "error";

/**
 * The project's transcript: the recording's words, and how the last attempt to
 * produce them went. It knows nothing about clips or captions. Callers that
 * need to clear those too compose their own reset on top of this one.
 */
export function useTranscript() {
  const [words, setWords] = useState<Word[]>([]);
  const [status, setStatus] = useState<TranscribeStatus>("idle");

  /**
   * Transcribe already-decoded audio. Returns the words, or null when the
   * backend fails, in which case the previous transcript is left alone.
   */
  const runOn = useCallback(
    async (audio: Float32Array, url: string): Promise<Word[] | null> => {
      setStatus("transcribing");
      try {
        const next = await transcribeToWords(audio, url);
        setWords(next);
        setStatus("done");
        return next;
      } catch (e) {
        console.error("[studio] transcription failed", e);
        setStatus("error");
        return null;
      }
    },
    [],
  );

  /**
   * Decode `url` and transcribe it. `onDecoded` runs between the two, because
   * the decoded audio is the only honest measure of the recording's length and
   * a caller may need to stretch the timeline before the words land.
   *
   * Status flips to "transcribing" before the decode, which is the slow half.
   */
  const run = useCallback(
    async (
      url: string,
      onDecoded?: (audio: Float32Array) => void,
    ): Promise<Word[] | null> => {
      setStatus("transcribing");
      let audio: Float32Array;
      try {
        audio = await decodeToMono16k(url);
      } catch (e) {
        console.error("[studio] transcription failed", e);
        setStatus("error");
        return null;
      }
      onDecoded?.(audio);
      return runOn(audio, url);
    },
    [runOn],
  );

  const reset = useCallback(() => {
    setWords([]);
    setStatus("idle");
  }, []);

  return { words, status, run, runOn, reset };
}
