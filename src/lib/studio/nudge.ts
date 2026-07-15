import type { OverlayRect } from "@/lib/studio/types";

/** A fine nudge of an overlay's position, as a fraction of the stage. */
export const NUDGE_STEP = 0.005;
/** A coarse nudge, applied while Shift is held. */
export const NUDGE_STEP_BIG = 0.02;

/**
 * The (dx, dy) direction an arrow key nudges in, or null for any other key. The
 * y axis grows downward (screen space), so ArrowUp is negative. Pure.
 */
export function nudgeDelta(key: string): { dx: number; dy: number } | null {
  switch (key) {
    case "ArrowLeft":
      return { dx: -1, dy: 0 };
    case "ArrowRight":
      return { dx: 1, dy: 0 };
    case "ArrowUp":
      return { dx: 0, dy: -1 };
    case "ArrowDown":
      return { dx: 0, dy: 1 };
    default:
      return null;
  }
}

/**
 * Shift a rect's position by (dx, dy) steps, keeping the whole box on the stage:
 * its far edges never cross 0 or 1. Size is untouched. Pure.
 */
export function nudgeRect(
  rect: OverlayRect,
  dx: number,
  dy: number,
  step: number,
): OverlayRect {
  const clamp = (v: number, max: number) => Math.max(0, Math.min(max, v));
  return {
    ...rect,
    x: clamp(rect.x + dx * step, 1 - rect.w),
    y: clamp(rect.y + dy * step, 1 - rect.h),
  };
}
