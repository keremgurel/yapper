"use client";

import { useCallback, useMemo, useState } from "react";
import {
  canRedo as historyCanRedo,
  canUndo as historyCanUndo,
  commit,
  INITIAL_HISTORY,
  redo as historyRedo,
  reset as historyReset,
  undo as historyUndo,
  type EditorState,
} from "@/lib/studio/history";
import type { AudioTrack, Caption, Clip, Overlay } from "@/lib/studio/types";

type Updater<T> = T | ((prev: T) => T);

const apply = <T>(updater: Updater<T>, prev: T): T =>
  typeof updater === "function" ? (updater as (p: T) => T)(prev) : updater;

/**
 * The undoable project state. Every layer goes through here, so one Cmd-Z
 * reverses the last edit whatever it touched. Setters that fire continuously
 * during a gesture (dragging an overlay, typing into a caption) take a
 * `coalesceKey`: pass one key per gesture and the whole gesture collapses into a
 * single undo step. `updateEditor` commits several layers at once, so an action
 * like "delete everything selected" is one step rather than one per layer.
 *
 * The history reducer itself lives in lib/studio/history.ts and is unit-tested.
 */
export function useEditorHistory() {
  const [history, setHistory] = useState(INITIAL_HISTORY);

  const updateEditor = useCallback(
    (updater: (prev: EditorState) => EditorState, coalesceKey?: string) => {
      setHistory((h) => commit(h, updater(h.present), coalesceKey));
    },
    [],
  );

  /** Commit one layer, skipping the commit when that layer is unchanged. */
  const setSlice = useCallback(
    <K extends keyof EditorState>(
      key: K,
      updater: Updater<EditorState[K]>,
      coalesceKey?: string,
    ) => {
      setHistory((h) => {
        const value = apply(updater, h.present[key]);
        if (value === h.present[key]) return h;
        return commit(h, { ...h.present, [key]: value }, coalesceKey);
      });
    },
    [],
  );

  const setClips = useCallback(
    (updater: Updater<Clip[]>) => setSlice("clips", updater),
    [setSlice],
  );

  const setCaptions = useCallback(
    (updater: Updater<Caption[]>, coalesceKey?: string) => {
      setHistory((h) => {
        const captions = apply(updater, h.present.captions);
        if (captions === h.present.captions) return h;
        // Clearing already-empty captions isn't an edit worth recording.
        if (captions.length === 0 && h.present.captions.length === 0) return h;
        return commit(h, { ...h.present, captions }, coalesceKey);
      });
    },
    [],
  );

  const setOverlays = useCallback(
    (updater: Updater<Overlay[]>, coalesceKey?: string) =>
      setSlice("overlays", updater, coalesceKey),
    [setSlice],
  );

  const setAudioTracks = useCallback(
    (updater: Updater<AudioTrack[]>, coalesceKey?: string) =>
      setSlice("audioTracks", updater, coalesceKey),
    [setSlice],
  );

  const setBaseHidden = useCallback(
    (updater: Updater<boolean>) => setSlice("baseHidden", updater),
    [setSlice],
  );

  const setBaseMuted = useCallback(
    (updater: Updater<boolean>) => setSlice("baseMuted", updater),
    [setSlice],
  );

  const resetEditor = useCallback((next: Partial<EditorState>) => {
    setHistory(historyReset(next));
  }, []);

  const undo = useCallback(() => setHistory(historyUndo), []);
  const redo = useCallback(() => setHistory(historyRedo), []);

  const { present } = history;

  return useMemo(
    () => ({
      clips: present.clips,
      captions: present.captions,
      overlays: present.overlays,
      audioTracks: present.audioTracks,
      baseHidden: present.baseHidden,
      baseMuted: present.baseMuted,
      setClips,
      setCaptions,
      setOverlays,
      setAudioTracks,
      setBaseHidden,
      setBaseMuted,
      updateEditor,
      resetEditor,
      undo,
      redo,
      canUndo: historyCanUndo(history),
      canRedo: historyCanRedo(history),
    }),
    [
      history,
      present,
      setClips,
      setCaptions,
      setOverlays,
      setAudioTracks,
      setBaseHidden,
      setBaseMuted,
      updateEditor,
      resetEditor,
      undo,
      redo,
    ],
  );
}
