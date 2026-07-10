import { clipDuration } from "@/lib/studio/clips";
import type { Clip } from "@/lib/studio/types";

/** How close a dragged edge must come to a snap point, in screen pixels. */
export const SNAP_PX = 8;

/**
 * The instants a dragged clip wants to line up with: the start and end of the
 * project, the playhead, and every seam in the bottom track.
 */
export function timelineSnapPoints(
  clips: Clip[],
  total: number,
  playhead: number,
): number[] {
  const seams: number[] = [];
  let acc = 0;
  for (const clip of clips) {
    acc += clipDuration(clip);
    seams.push(acc);
  }
  return [0, total, playhead, ...seams];
}

/** The nearest point within `threshold` of `v`, or `v` itself. */
function nearest(v: number, points: number[], threshold: number): number {
  let best = v;
  let bestDistance = threshold;
  for (const p of points) {
    const d = Math.abs(p - v);
    if (d < bestDistance) {
      bestDistance = d;
      best = p;
    }
  }
  return best;
}

/**
 * Where a dragged clip's start should sit, once magnetism has had its say.
 *
 * Either edge can catch a snap point, and the clip moves so that edge lands on
 * it. The leading edge wins when both are in range, because that is the edge
 * under the pointer. Nothing is ever dragged before 0:00.
 */
export function snapClipStart(
  start: number,
  duration: number,
  points: number[],
  threshold: number,
): number {
  const snappedStart = nearest(start, points, threshold);
  if (snappedStart !== start) return Math.max(0, snappedStart);

  const end = start + duration;
  const snappedEnd = nearest(end, points, threshold);
  if (snappedEnd !== end) return Math.max(0, snappedEnd - duration);

  return Math.max(0, start);
}
