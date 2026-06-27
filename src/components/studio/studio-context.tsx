"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  fullClip,
  removeClip,
  removeSourceRange,
  splitAtSource,
  trimClipEnd,
  trimClipStart,
} from "@/lib/studio/clips";
import { detectSilences } from "@/lib/studio/silence";
import {
  findEarlierTakeRanges,
  findFillerIds,
  selectionToRanges,
} from "@/lib/studio/transcript-edit";
import { decodeToMono16k } from "@/lib/studio/audio-decode";
import { transcribeAudio } from "@/lib/studio/transcribe";
import { consumePendingVideo } from "@/lib/studio/handoff";
import { loadVideoSource } from "@/lib/studio/load-source";
import {
  newWordId,
  type Clip,
  type StudioSource,
  type Word,
} from "@/lib/studio/types";

export type TranscribeStatus =
  | "idle"
  | "loading"
  | "transcribing"
  | "done"
  | "error";

interface StudioContextValue {
  source: StudioSource | null;
  clips: Clip[];
  selectedClipId: string | null;
  detecting: boolean;
  words: Word[];
  transcribeStatus: TranscribeStatus;
  transcribeProgress: number;
  loadSource: (source: StudioSource) => void;
  clearSource: () => void;
  selectClip: (id: string | null) => void;
  splitAt: (sourceTime: number) => void;
  deleteSelected: () => void;
  trimStart: (sourceTime: number) => void;
  trimEnd: (sourceTime: number) => void;
  removeSilences: () => Promise<number>;
  transcribe: () => Promise<void>;
  deleteWords: (ids: string[]) => void;
  removeFillers: () => number;
  removeEarlierTakes: () => number;
  reset: () => void;
}

const StudioContext = createContext<StudioContextValue | null>(null);

export function StudioProvider({ children }: { children: React.ReactNode }) {
  const [source, setSource] = useState<StudioSource | null>(null);
  const [clips, setClips] = useState<Clip[]>([]);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [words, setWords] = useState<Word[]>([]);
  const [transcribeStatus, setTranscribeStatus] =
    useState<TranscribeStatus>("idle");
  const [transcribeProgress, setTranscribeProgress] = useState(0);
  const [detecting, setDetecting] = useState(false);

  const resetTranscript = useCallback(() => {
    setWords([]);
    setTranscribeStatus("idle");
    setTranscribeProgress(0);
  }, []);

  const loadSource = useCallback(
    (next: StudioSource) => {
      setSource((prev) => {
        if (prev) URL.revokeObjectURL(prev.url);
        return next;
      });
      setClips(fullClip(next.duration));
      setSelectedClipId(null);
      resetTranscript();
    },
    [resetTranscript],
  );

  const clearSource = useCallback(() => {
    setSource((prev) => {
      if (prev) URL.revokeObjectURL(prev.url);
      return null;
    });
    setClips([]);
    setSelectedClipId(null);
    resetTranscript();
  }, [resetTranscript]);

  // Pick up a recording handed over from the practice flow (Record -> Edit).
  useEffect(() => {
    const blob = consumePendingVideo();
    if (!blob) return;
    loadVideoSource(blob, "Practice take")
      .then(loadSource)
      .catch(() => {});
  }, [loadSource]);

  const splitAt = useCallback((sourceTime: number) => {
    setClips((prev) => splitAtSource(prev, sourceTime));
  }, []);

  const deleteSelected = useCallback(() => {
    setClips((prev) =>
      selectedClipId ? removeClip(prev, selectedClipId) : prev,
    );
    setSelectedClipId(null);
  }, [selectedClipId]);

  const trimStart = useCallback(
    (sourceTime: number) => {
      setClips((prev) =>
        selectedClipId ? trimClipStart(prev, selectedClipId, sourceTime) : prev,
      );
    },
    [selectedClipId],
  );

  const trimEnd = useCallback(
    (sourceTime: number) => {
      setClips((prev) =>
        selectedClipId ? trimClipEnd(prev, selectedClipId, sourceTime) : prev,
      );
    },
    [selectedClipId],
  );

  const removeSilences = useCallback(async (): Promise<number> => {
    if (!source) return 0;
    setDetecting(true);
    try {
      const ranges = await detectSilences(source.url);
      if (ranges.length > 0) {
        setClips((prev) => {
          let next = prev;
          for (const [from, to] of ranges)
            next = removeSourceRange(next, from, to);
          return next;
        });
      }
      return ranges.length;
    } finally {
      setDetecting(false);
    }
  }, [source]);

  const transcribe = useCallback(async (): Promise<void> => {
    if (!source) return;
    setTranscribeStatus("loading");
    setTranscribeProgress(0);
    try {
      const audio = await decodeToMono16k(source.url);
      const raw = await transcribeAudio(audio, (p) => {
        if (p.status === "loading" && typeof p.progress === "number") {
          setTranscribeProgress(Math.round(p.progress));
        } else if (p.status === "transcribing") {
          setTranscribeStatus("transcribing");
        }
      });
      setWords(raw.map((w, i) => ({ id: newWordId(i), ...w })));
      setTranscribeStatus("done");
    } catch {
      setTranscribeStatus("error");
    }
  }, [source]);

  const applyCuts = useCallback((ranges: [number, number][]) => {
    if (ranges.length === 0) return;
    setClips((prev) => {
      let next = prev;
      for (const [from, to] of ranges) next = removeSourceRange(next, from, to);
      return next;
    });
  }, []);

  const deleteWords = useCallback(
    (ids: string[]) => {
      if (ids.length === 0) return;
      applyCuts(selectionToRanges(words, new Set(ids)));
    },
    [words, applyCuts],
  );

  const removeFillers = useCallback((): number => {
    const ids = findFillerIds(words);
    if (ids.length > 0) applyCuts(selectionToRanges(words, new Set(ids)));
    return ids.length;
  }, [words, applyCuts]);

  const removeEarlierTakes = useCallback((): number => {
    const ranges = findEarlierTakeRanges(words);
    applyCuts(ranges);
    return ranges.length;
  }, [words, applyCuts]);

  const reset = useCallback(() => {
    setClips(source ? fullClip(source.duration) : []);
    setSelectedClipId(null);
  }, [source]);

  const value = useMemo<StudioContextValue>(
    () => ({
      source,
      clips,
      selectedClipId,
      detecting,
      words,
      transcribeStatus,
      transcribeProgress,
      loadSource,
      clearSource,
      selectClip: setSelectedClipId,
      splitAt,
      deleteSelected,
      trimStart,
      trimEnd,
      removeSilences,
      transcribe,
      deleteWords,
      removeFillers,
      removeEarlierTakes,
      reset,
    }),
    [
      source,
      clips,
      selectedClipId,
      detecting,
      words,
      transcribeStatus,
      transcribeProgress,
      loadSource,
      clearSource,
      splitAt,
      deleteSelected,
      trimStart,
      trimEnd,
      removeSilences,
      transcribe,
      deleteWords,
      removeFillers,
      removeEarlierTakes,
      reset,
    ],
  );

  return <StudioContext value={value}>{children}</StudioContext>;
}

export function useStudio(): StudioContextValue {
  const ctx = useContext(StudioContext);
  if (!ctx) throw new Error("useStudio must be used within StudioProvider");
  return ctx;
}
