import type { EditorState } from "@/lib/studio/history";

/** The ids selected on each layer, as sets for O(1) membership. */
export interface SelectionIds {
  clipIds: Set<string>;
  overlayIds: Set<string>;
  captionIds: Set<string>;
  audioIds: Set<string>;
}

/**
 * Remove every selected item from the editor state across all four layers at
 * once, so one Delete is a single undo step even when the selection spans a
 * clip, an overlay, a caption, and an audio track together.
 *
 * A layer with nothing selected keeps its EXACT array reference: the history
 * reducer treats an unchanged reference as a no-op, so untouched layers neither
 * re-render nor stack a spurious undo step. Rebuilding those arrays would look
 * like an edit to every layer on every delete.
 */
export function deleteSelectedFrom(
  state: EditorState,
  ids: SelectionIds,
): EditorState {
  return {
    ...state,
    clips: ids.clipIds.size
      ? state.clips.filter((c) => !ids.clipIds.has(c.id))
      : state.clips,
    overlays: ids.overlayIds.size
      ? state.overlays.filter((o) => !ids.overlayIds.has(o.id))
      : state.overlays,
    captions: ids.captionIds.size
      ? state.captions.filter((c) => !ids.captionIds.has(c.id))
      : state.captions,
    audioTracks: ids.audioIds.size
      ? state.audioTracks.filter((a) => !ids.audioIds.has(a.id))
      : state.audioTracks,
  };
}
