import { clipDuration } from "@/lib/studio/clips";
import type { AudioTrack, Clip, Overlay } from "@/lib/studio/types";

/** How close a dragged edge must come to a snap point, in screen pixels. */
export const SNAP_PX = 8;

/**
 * The instants a dragged clip wants to line up with: the start and end of the
 * project, the playhead, every seam in the bottom track, and the start and end
 * of every other overlay and audio clip. Lining up with a neighbor's edge is
 * what a pro editor's magnet does, so cutaways and music butt up cleanly.
 *
 * `excludeId` is the clip being dragged: it must never snap to its own edges,
 * which would pin it in place. A hidden overlay is composited nowhere, so it
 * offers no edge to snap to either.
 */
export function timelineSnapPoints(
  clips: Clip[],
  overlays: Overlay[],
  audioTracks: AudioTrack[],
  total: number,
  playhead: number,
  excludeId?: string,
): number[] {
  const points: number[] = [0, total, playhead];
  let acc = 0;
  for (const clip of clips) {
    acc += clipDuration(clip);
    points.push(acc);
  }
  for (const o of overlays) {
    if (o.id === excludeId || o.hidden) continue;
    points.push(o.start, o.start + o.duration);
  }
  for (const a of audioTracks) {
    if (a.id === excludeId) continue;
    points.push(a.start, a.start + a.duration);
  }
  return points;
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
