"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { prepareTranscriptionSource } from "@/lib/studio/audio-decode";
import { transcribeToWords } from "@/lib/studio/transcribe";
import { newWordId, type Word } from "@/lib/studio/types";
import {
  applyTranscriptionDictionary,
  type TranscriptionDictionaryEntry,
} from "@/lib/studio/transcription-dictionary";
import type { AsrAudio } from "@/lib/studio/audio/asr-audio";

export type TranscribeStatus = "idle" | "transcribing" | "done" | "error";

export class TranscriptionRunFence {
  current: AbortController | null = null;
  begin(): AbortController {
    this.current?.abort("superseded");
    const controller = new AbortController();
    this.current = controller;
    return controller;
  }
  cancel(reason = "canceled"): void {
    this.current?.abort(reason);
    this.current = null;
  }
  owns(controller: AbortController): boolean {
    return this.current === controller && !controller.signal.aborted;
  }
}

export function correctWordSpellings(
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
  // Collapsing a multi-token alias shortens the array. Generating its ID from
  // the corrected index can then collide with an unchanged word's original ID
  // (for example new `w-2` beside retained `w-2`). Allocate beyond the original
  // ID space and still check the actual strings, since imported words need not
  // use the default ID format.
  const reserved = new Set(current.map((word) => word.id));
  const assigned = new Set<string>();
  let nextId = current.length;
  const freshId = () => {
    let id: string;
    do id = newWordId(nextId++);
    while (reserved.has(id) || assigned.has(id));
    assigned.add(id);
    return id;
  };
  return corrected.map((word) => {
    const existing = idsByRange.get(`${word.start}:${word.end}`);
    const id = existing && !assigned.has(existing) ? existing : freshId();
    assigned.add(id);
    return { ...word, id };
  });
}

/**
 * The project's transcript: the recording's words, and how the last attempt to
 * produce them went. It knows nothing about clips or captions. Callers that
 * need to clear those too compose their own reset on top of this one.
 */
export function useTranscript(dictionary: TranscriptionDictionaryEntry[] = []) {
  const [rawWords, setRawWords] = useState<Word[]>([]);
  const [status, setStatus] = useState<TranscribeStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fence] = useState(() => new TranscriptionRunFence());
  useEffect(() => () => fence.cancel("unmounted"), [fence]);
  const begin = useCallback(() => {
    return fence.begin();
  }, [fence]);
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
    async (
      audio: Float32Array,
      url: string,
      preparedChunks?: AsrAudio[],
    ): Promise<Word[] | null> => {
      const controller = begin();
      setStatus("transcribing");
      setErrorMessage(null);
      try {
        const next = await transcribeToWords(
          audio,
          url,
          dictionary,
          controller.signal,
          preparedChunks,
        );
        controller.signal.throwIfAborted();
        if (!fence.owns(controller)) return null;
        setRawWords(next);
        setStatus("done");
        return next;
      } catch (e) {
        if (controller.signal.aborted) {
          if (fence.current === controller) setStatus("idle");
          return null;
        }
        console.error("[studio] transcription failed", e);
        setErrorMessage(
          e instanceof Error
            ? e.message
            : "An unexpected transcription error occurred.",
        );
        setStatus("error");
        return null;
      }
    },
    [begin, dictionary, fence],
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
      setErrorMessage(null);
      const controller = begin();
      let audio: Float32Array;
      let chunks;
      try {
        const prepared = await prepareTranscriptionSource(
          url,
          controller.signal,
        );
        audio = prepared.mono16k;
        chunks = prepared.chunks;
      } catch (e) {
        if (controller.signal.aborted) {
          if (fence.current === controller) setStatus("idle");
          return null;
        }
        console.error("[studio] transcription failed", e);
        setErrorMessage(
          e instanceof Error ? e.message : "The audio could not be prepared.",
        );
        setStatus("error");
        return null;
      }
      if (controller.signal.aborted) return null;
      onDecoded?.(audio);
      try {
        const next = await transcribeToWords(
          audio,
          url,
          dictionary,
          controller.signal,
          chunks,
        );
        controller.signal.throwIfAborted();
        if (!fence.owns(controller)) return null;
        setRawWords(next);
        setStatus("done");
        return next;
      } catch (e) {
        if (controller.signal.aborted) {
          if (fence.current === controller) setStatus("idle");
          return null;
        }
        console.error("[studio] transcription failed", e);
        setErrorMessage(
          e instanceof Error
            ? e.message
            : "An unexpected transcription error occurred.",
        );
        setStatus("error");
        return null;
      }
    },
    [begin, dictionary, fence],
  );

  const cancel = useCallback(() => {
    fence.cancel();
    setErrorMessage(null);
    setStatus("idle");
  }, [fence]);

  const reset = useCallback(() => {
    fence.cancel("reset");
    setRawWords([]);
    setStatus("idle");
    setErrorMessage(null);
  }, [fence]);

  return { words, status, errorMessage, run, runOn, cancel, reset };
}
