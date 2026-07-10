import type { AudioTrack, Caption, Clip, Overlay } from "@/lib/studio/types";

/**
 * The undoable project. Every layer belongs here, not just the bottom track's
 * clips: one Cmd-Z reverses the last edit whether it moved a clip, retimed a
 * caption, trimmed an overlay, dragged an audio track, or muted the base.
 */
export interface EditorState {
  clips: Clip[];
  captions: Caption[];
  overlays: Overlay[];
  audioTracks: AudioTrack[];
  baseHidden: boolean;
  baseMuted: boolean;
}

export interface History {
  past: EditorState[];
  present: EditorState;
  future: EditorState[];
  /**
   * Key of the last commit. Consecutive commits sharing a non-null key collapse
   * into a single undo step, so a continuous gesture (typing into one caption,
   * dragging one overlay across the timeline) is one step and not one per event.
   * Keys are per-gesture, so two separate drags of the same overlay stay
   * separately undoable.
   */
  coalesceKey?: string;
}

/** Depth bound. A long session shouldn't pin every intermediate array forever. */
const MAX_DEPTH = 200;

export const EMPTY_EDITOR_STATE: EditorState = {
  clips: [],
  captions: [],
  overlays: [],
  audioTracks: [],
  baseHidden: false,
  baseMuted: false,
};

export const INITIAL_HISTORY: History = {
  past: [],
  present: EMPTY_EDITOR_STATE,
  future: [],
};

/** Record `next` as the present, pushing the old present onto the undo stack. */
export function commit(
  history: History,
  next: EditorState,
  coalesceKey?: string,
): History {
  if (next === history.present) return history;
  // Same gesture as the last commit: overwrite the present, don't stack a step.
  if (coalesceKey != null && coalesceKey === history.coalesceKey) {
    return { ...history, present: next, future: [] };
  }
  const past = [...history.past, history.present];
  return {
    past: past.length > MAX_DEPTH ? past.slice(past.length - MAX_DEPTH) : past,
    present: next,
    future: [],
    coalesceKey,
  };
}

export function undo(history: History): History {
  if (history.past.length === 0) return history;
  return {
    past: history.past.slice(0, -1),
    present: history.past[history.past.length - 1],
    future: [history.present, ...history.future],
    coalesceKey: undefined,
  };
}

export function redo(history: History): History {
  if (history.future.length === 0) return history;
  return {
    past: [...history.past, history.present],
    present: history.future[0],
    future: history.future.slice(1),
    coalesceKey: undefined,
  };
}

/** Replace the project wholesale and drop its history (new source, or Reset). */
export function reset(state: Partial<EditorState>): History {
  return {
    past: [],
    present: { ...EMPTY_EDITOR_STATE, ...state },
    future: [],
  };
}

export const canUndo = (history: History): boolean => history.past.length > 0;
export const canRedo = (history: History): boolean => history.future.length > 0;
