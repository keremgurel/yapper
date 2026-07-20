"use client";

import { useCallback, useMemo, useState } from "react";
import { decodeToMono16k } from "@/lib/studio/audio-decode";
import { transcribeToWords } from "@/lib/studio/transcribe";
import { newWordId, type Word } from "@/lib/studio/types";
import {
  applyTranscriptionDictionary,
  type TranscriptionDictionaryEntry,
} from "@/lib/studio/transcription-dictionary";

export type TranscribeStatus = "idle" | "transcribing" | "done" | "error";

function correctWordSpellings(
  current: Word[],
  dictionary: TranscriptionDictionaryEntry[],
): Word[] {
  if (dictionary.length === 0) return current;
  const corrected = applyTranscriptionDictionary(current, dictionary);
  const changed =
    corrected.length !== current.length ||
    corrected.some((word, i) => word.text !== current[i]?.text);
  if (!changed) return current;
  const idsByRange = new Map(
    current.map((word) => [`${word.start}:${word.end}`, word.id]),
  );
  return corrected.map((word, i) => ({
    ...word,
    id: idsByRange.get(`${word.start}:${word.end}`) ?? newWordId(i),
  }));
}

/**
 * The project's transcript: the recording's words, and how the last attempt to
 * produce them went. It knows nothing about clips or captions. Callers that
 * need to clear those too compose their own reset on top of this one.
 */
export function useTranscript(dictionary: TranscriptionDictionaryEntry[] = []) {
  const [rawWords, setRawWords] = useState<Word[]>([]);
  const [status, setStatus] = useState<TranscribeStatus>("idle");
  // A word remembered after transcription also fixes this open project, so
  // regenerating captions cannot bring the old misspelling back.
  const words = useMemo(
    () => correctWordSpellings(rawWords, dictionary),
    [rawWords, dictionary],
  );

  /**
   * Transcribe already-decoded audio. Returns the words, or null when the
   * backend fails, in which case the previous transcript is left alone.
   */
  const runOn = useCallback(
    async (audio: Float32Array, url: string): Promise<Word[] | null> => {
      setStatus("transcribing");
      try {
        const next = await transcribeToWords(audio, url, dictionary);
        setRawWords(next);
        setStatus("done");
        return next;
      } catch (e) {
        console.error("[studio] transcription failed", e);
        setStatus("error");
        return null;
      }
    },
    [dictionary],
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
    setRawWords([]);
    setStatus("idle");
  }, []);

  return { words, status, run, runOn, reset };
}
