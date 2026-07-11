import { clipDuration } from "@/lib/studio/clips";
import type { Clip } from "@/lib/studio/types";

/**
 * A pointer has to travel this far before a press becomes a drag. Below it the
 * movement is the jitter of a click, and treating it as a drag would reorder
 * clips every time you selected one.
 */
export const DRAG_JITTER_PX = 4;

/**
 * Drag a clip this far off its own track and it leaves it: up, onto a new upper
 * video track; down (for an overlay), into the bottom sequence.
 */
export const LIFT_THRESHOLD_PX = 40;

/**
 * Where a dragged clip lands: the number of other clips whose middle it has
 * passed. Feed this straight to `moveClipTo`, whose index counts the clips that
 * remain once the dragged one is lifted out, which is exactly what this counts.
 *
 * The other clips do not shift while one is dragged, so their midpoints are
 * measured against the resting timeline, gap and all.
 */
export function dropIndexAt(
  clips: Clip[],
  draggedId: string,
  centerSec: number,
): number {
  let acc = 0;
  let index = 0;
  for (const clip of clips) {
    const middle = acc + clipDuration(clip) / 2;
    if (clip.id !== draggedId && middle < centerSec) index++;
    acc += clipDuration(clip);
  }
  return index;
}
