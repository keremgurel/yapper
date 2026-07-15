import type { OverlayRect } from "@/lib/studio/types";

/** Snap distance as a fraction of the stage: an overlay edge/center within this
 * of a guide line clicks onto it, Canva-style. */
export const ALIGN_SNAP = 0.012;

/**
 * The vertical guide lines (x positions) an overlay snaps against: the stage's
 * left edge, center, and right edge, plus every other overlay's left, center,
 * and right. The dragged overlay is never in `others`, so it can't snap to
 * itself.
 */
export function verticalTargets(others: OverlayRect[]): number[] {
  return [0, 0.5, 1, ...others.flatMap((o) => [o.x, o.x + o.w / 2, o.x + o.w])];
}

/** The horizontal guide lines (y positions): the stage's top, middle, and
 * bottom, plus every other overlay's top, middle, and bottom. */
export function horizontalTargets(others: OverlayRect[]): number[] {
  return [0, 0.5, 1, ...others.flatMap((o) => [o.y, o.y + o.h / 2, o.y + o.h])];
}

/**
 * Snap a moving span to the nearest target line. Its start, center, and end are
 * each tested against every target; the closest pairing within `snap` wins.
 * Returns the delta to shift the span by and the guide line it landed on, or
 * null when nothing is in range. Pure.
 */
export function snapSpan(
  start: number,
  size: number,
  targets: number[],
  snap: number = ALIGN_SNAP,
): { delta: number; guide: number } | null {
  const edges = [start, start + size / 2, start + size];
  let best: { delta: number; guide: number } | null = null;
  for (const e of edges) {
    for (const t of targets) {
      const delta = t - e;
      if (
        Math.abs(delta) <= snap &&
        (!best || Math.abs(delta) < Math.abs(best.delta))
      ) {
        best = { delta, guide: t };
      }
    }
  }
  return best;
}

/** Snap a single edge to the nearest target line within `snap`, or null. Pure. */
export function snapEdge(
  pos: number,
  targets: number[],
  snap: number = ALIGN_SNAP,
): number | null {
  let best: number | null = null;
  for (const t of targets) {
    if (
      Math.abs(t - pos) <= snap &&
      (best === null || Math.abs(t - pos) < Math.abs(best - pos))
    ) {
      best = t;
    }
  }
  return best;
}
