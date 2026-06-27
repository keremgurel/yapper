"use client";

import { useCallback, useMemo, useState } from "react";
import type { Clip } from "@/lib/studio/types";

interface HistoryState {
  past: Clip[][];
  present: Clip[];
  future: Clip[][];
}

/**
 * Undoable clip state. All edits go through `setClips` (an updater), which pushes
 * the previous value onto the undo stack. `resetClips` replaces history wholesale
 * (e.g. when a new source loads).
 */
export function useClipHistory() {
  const [state, setState] = useState<HistoryState>({
    past: [],
    present: [],
    future: [],
  });

  const setClips = useCallback((updater: (prev: Clip[]) => Clip[]) => {
    setState((s) => {
      const next = updater(s.present);
      if (next === s.present) return s;
      return { past: [...s.past, s.present], present: next, future: [] };
    });
  }, []);

  const resetClips = useCallback((clips: Clip[]) => {
    setState({ past: [], present: clips, future: [] });
  }, []);

  const undo = useCallback(() => {
    setState((s) => {
      if (s.past.length === 0) return s;
      const previous = s.past[s.past.length - 1];
      return {
        past: s.past.slice(0, -1),
        present: previous,
        future: [s.present, ...s.future],
      };
    });
  }, []);

  const redo = useCallback(() => {
    setState((s) => {
      if (s.future.length === 0) return s;
      const next = s.future[0];
      return {
        past: [...s.past, s.present],
        present: next,
        future: s.future.slice(1),
      };
    });
  }, []);

  return useMemo(
    () => ({
      clips: state.present,
      setClips,
      resetClips,
      undo,
      redo,
      canUndo: state.past.length > 0,
      canRedo: state.future.length > 0,
    }),
    [
      state.present,
      state.past.length,
      state.future.length,
      setClips,
      resetClips,
      undo,
      redo,
    ],
  );
}
