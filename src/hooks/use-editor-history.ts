"use client";

import { useCallback, useMemo, useState } from "react";
import type { Caption, Clip } from "@/lib/studio/types";

/** The undoable slice of the editor: the timeline and its captions, together, so
 * one Cmd-Z reverses the last edit whether it touched clips or captions. */
interface EditorState {
  clips: Clip[];
  captions: Caption[];
}

interface History {
  past: EditorState[];
  present: EditorState;
  future: EditorState[];
  // Key of the last commit. Consecutive commits sharing a non-null key (e.g.
  // typing into one caption) collapse into a single undo step.
  coalesceKey?: string;
}

type ClipUpdater = (prev: Clip[]) => Clip[];
type CaptionUpdater = Caption[] | ((prev: Caption[]) => Caption[]);

const EMPTY: EditorState = { clips: [], captions: [] };

/**
 * Undoable clip + caption state. Every edit goes through `setClips` / `setCaptions`,
 * which push the previous value onto the undo stack. `setCaptions` accepts an
 * optional coalesce key so a burst of edits (character-by-character typing) is one
 * undo step, not one per keystroke. `resetEditor` replaces history wholesale (a
 * new source, or the Reset button).
 */
export function useEditorHistory() {
  const [state, setState] = useState<History>({
    past: [],
    present: EMPTY,
    future: [],
  });

  const setClips = useCallback((updater: ClipUpdater) => {
    setState((s) => {
      const clips = updater(s.present.clips);
      if (clips === s.present.clips) return s;
      return {
        past: [...s.past, s.present],
        present: { ...s.present, clips },
        future: [],
        coalesceKey: undefined,
      };
    });
  }, []);

  const setCaptions = useCallback(
    (updater: CaptionUpdater, coalesceKey?: string) => {
      setState((s) => {
        const captions =
          typeof updater === "function" ? updater(s.present.captions) : updater;
        if (captions === s.present.captions) return s;
        // Clearing already-empty captions isn't an edit worth recording.
        if (captions.length === 0 && s.present.captions.length === 0) return s;
        // Coalesce into the previous step when the keys match (same caption's
        // text being typed) — one undo reverts the whole edit, not each letter.
        if (coalesceKey && coalesceKey === s.coalesceKey) {
          return { ...s, present: { ...s.present, captions } };
        }
        return {
          past: [...s.past, s.present],
          present: { ...s.present, captions },
          future: [],
          coalesceKey,
        };
      });
    },
    [],
  );

  const resetEditor = useCallback((clips: Clip[], captions: Caption[] = []) => {
    setState({ past: [], present: { clips, captions }, future: [] });
  }, []);

  const undo = useCallback(() => {
    setState((s) => {
      if (s.past.length === 0) return s;
      const previous = s.past[s.past.length - 1];
      return {
        past: s.past.slice(0, -1),
        present: previous,
        future: [s.present, ...s.future],
        coalesceKey: undefined,
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
        coalesceKey: undefined,
      };
    });
  }, []);

  return useMemo(
    () => ({
      clips: state.present.clips,
      captions: state.present.captions,
      setClips,
      setCaptions,
      resetEditor,
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
      setCaptions,
      resetEditor,
      undo,
      redo,
    ],
  );
}
