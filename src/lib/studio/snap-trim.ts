import { nearest } from "@/lib/studio/snap";

/**
 * Snap a trim drag's delta so the dragged edge lands on the nearest magnet.
 *
 * The left edge sits at `start + deltaSec` on the timeline, the right edge at
 * `start + duration + deltaSec`; whichever is being dragged is pulled onto the
 * nearest snap point within `threshold`, and the delta that puts it there is
 * returned. When nothing is in range the delta comes back unchanged. The
 * caller's own min/max/in-point clamps still apply on top, so this only ever
 * proposes a position. Pure.
 */
export function snappedTrimDelta(
  edge: "start" | "end",
  start: number,
  duration: number,
  deltaSec: number,
  points: number[],
  threshold: number,
): number {
  const base = edge === "start" ? start : start + duration;
  return nearest(base + deltaSec, points, threshold) - base;
}
