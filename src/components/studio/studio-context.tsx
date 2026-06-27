"use client";

import {
  createContext,
  useCallback,
  useContext,
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
import type { Clip, StudioSource } from "@/lib/studio/types";

interface StudioContextValue {
  source: StudioSource | null;
  clips: Clip[];
  selectedClipId: string | null;
  detecting: boolean;
  loadSource: (source: StudioSource) => void;
  clearSource: () => void;
  selectClip: (id: string | null) => void;
  splitAt: (sourceTime: number) => void;
  deleteSelected: () => void;
  trimStart: (sourceTime: number) => void;
  trimEnd: (sourceTime: number) => void;
  removeSilences: () => Promise<number>;
  reset: () => void;
}

const StudioContext = createContext<StudioContextValue | null>(null);

export function StudioProvider({ children }: { children: React.ReactNode }) {
  const [source, setSource] = useState<StudioSource | null>(null);
  const [clips, setClips] = useState<Clip[]>([]);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [detecting, setDetecting] = useState(false);

  const loadSource = useCallback((next: StudioSource) => {
    setSource((prev) => {
      if (prev) URL.revokeObjectURL(prev.url);
      return next;
    });
    setClips(fullClip(next.duration));
    setSelectedClipId(null);
  }, []);

  const clearSource = useCallback(() => {
    setSource((prev) => {
      if (prev) URL.revokeObjectURL(prev.url);
      return null;
    });
    setClips([]);
    setSelectedClipId(null);
  }, []);

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
      loadSource,
      clearSource,
      selectClip: setSelectedClipId,
      splitAt,
      deleteSelected,
      trimStart,
      trimEnd,
      removeSilences,
      reset,
    }),
    [
      source,
      clips,
      selectedClipId,
      detecting,
      loadSource,
      clearSource,
      splitAt,
      deleteSelected,
      trimStart,
      trimEnd,
      removeSilences,
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
