"use client";

import { useCallback, useMemo } from "react";
import { useIdSelection } from "@/hooks/use-id-selection";

/**
 * Every way the selection can change. This object is stable for the life of the
 * editor, so a callback that only mutates the selection never has to be rebuilt
 * when the selection changes.
 */
export interface SelectionActions {
  /** Select just this clip, deselecting overlays and captions. */
  selectClip: (id: string | null) => void;
  /** Add or drop this clip, deselecting overlays and captions. */
  toggleClip: (id: string) => void;
  /** Restore a clip selection wholesale, leaving other kinds alone. */
  replaceClips: (ids: string[]) => void;
  /** Deselect this clip. For when the clip itself goes away. */
  dropClip: (id: string) => void;
  clearClips: () => void;

  selectOverlay: (id: string | null) => void;
  toggleOverlay: (id: string) => void;
  replaceOverlays: (ids: string[]) => void;
  dropOverlay: (id: string) => void;
  clearOverlays: () => void;

  selectCaption: (id: string | null) => void;
  toggleCaption: (id: string) => void;
  replaceCaptions: (ids: string[]) => void;
  dropCaption: (id: string) => void;
  clearCaptions: () => void;

  /** Deselect everything, of every kind. */
  clearSelection: () => void;
}

/**
 * What's selected on the timeline. Elements come in three kinds (base clips,
 * upper-track overlays, captions) and a click selects one kind while clearing
 * the others, so Delete and Split always act on exactly what's highlighted.
 *
 * Two deliberate asymmetries, both preserved from the code this replaces.
 * Selecting nothing (`selectX(null)`) clears only its own kind, so clicking
 * empty base track does not blow away a selected caption. And `replaceX` does
 * not clear the other kinds either: it restores a selection rather than
 * expressing a click.
 */
export function useEditorSelection() {
  const clips = useIdSelection();
  const overlays = useIdSelection();
  const captions = useIdSelection();

  // Pulled out by name because every one of them is stable, which is what keeps
  // `actions` below stable in turn.
  const { select: pickClip, toggle: flipClip } = clips;
  const { select: pickOverlay, toggle: flipOverlay } = overlays;
  const { select: pickCaption, toggle: flipCaption } = captions;
  const { replace: replaceClips, remove: dropClip, clear: clearClips } = clips;
  const {
    replace: replaceOverlays,
    remove: dropOverlay,
    clear: clearOverlays,
  } = overlays;
  const {
    replace: replaceCaptions,
    remove: dropCaption,
    clear: clearCaptions,
  } = captions;

  const clearSelection = useCallback(() => {
    clearClips();
    clearOverlays();
    clearCaptions();
  }, [clearClips, clearOverlays, clearCaptions]);

  const selectClip = useCallback(
    (id: string | null) => {
      pickClip(id);
      if (id) {
        clearOverlays();
        clearCaptions();
      }
    },
    [pickClip, clearOverlays, clearCaptions],
  );

  const toggleClip = useCallback(
    (id: string) => {
      flipClip(id);
      clearOverlays();
      clearCaptions();
    },
    [flipClip, clearOverlays, clearCaptions],
  );

  const selectOverlay = useCallback(
    (id: string | null) => {
      pickOverlay(id);
      if (id) {
        clearClips();
        clearCaptions();
      }
    },
    [pickOverlay, clearClips, clearCaptions],
  );

  const toggleOverlay = useCallback(
    (id: string) => {
      flipOverlay(id);
      clearClips();
      clearCaptions();
    },
    [flipOverlay, clearClips, clearCaptions],
  );

  const selectCaption = useCallback(
    (id: string | null) => {
      pickCaption(id);
      if (id) {
        clearClips();
        clearOverlays();
      }
    },
    [pickCaption, clearClips, clearOverlays],
  );

  const toggleCaption = useCallback(
    (id: string) => {
      flipCaption(id);
      clearClips();
      clearOverlays();
    },
    [flipCaption, clearClips, clearOverlays],
  );

  const actions = useMemo<SelectionActions>(
    () => ({
      selectClip,
      toggleClip,
      replaceClips,
      dropClip,
      clearClips,
      selectOverlay,
      toggleOverlay,
      replaceOverlays,
      dropOverlay,
      clearOverlays,
      selectCaption,
      toggleCaption,
      replaceCaptions,
      dropCaption,
      clearCaptions,
      clearSelection,
    }),
    [
      selectClip,
      toggleClip,
      replaceClips,
      dropClip,
      clearClips,
      selectOverlay,
      toggleOverlay,
      replaceOverlays,
      dropOverlay,
      clearOverlays,
      selectCaption,
      toggleCaption,
      replaceCaptions,
      dropCaption,
      clearCaptions,
      clearSelection,
    ],
  );

  return {
    clipIds: clips.ids,
    overlayIds: overlays.ids,
    captionIds: captions.ids,
    /** The one selected clip, or null. Trim only makes sense on exactly one. */
    selectedClipId: clips.only,
    /** The one selected caption, or null. */
    selectedCaptionId: captions.only,
    actions,
  };
}
