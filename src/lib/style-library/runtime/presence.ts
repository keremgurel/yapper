import type { CSSProperties } from "react";
import { clamp01, easeInCubic, easeOutSettle } from "./easing";

/**
 * How present something is at `time`: 0 before it enters, eased up to 1, held,
 * then back to 0 by `durationS`. Exits are shorter than entrances and use a
 * plain ease-in, so things leave faster than they arrive.
 */
export function presence(
  time: number,
  durationS: number,
  enterS: number,
  exitS: number,
): number {
  const entering = enterS > 0 ? easeOutSettle(clamp01(time / enterS)) : 1;
  const leaving =
    exitS > 0
      ? 1 - easeInCubic(clamp01((time - (durationS - exitS)) / exitS))
      : 1;
  return time < 0 || time > durationS ? 0 : Math.min(entering, leaving);
}

/** The shared entrance: a short rise, a small scale-up and a fade. */
export const reveal = (t: number, risePx: number): CSSProperties => ({
  opacity: Math.min(1, t * 1.4),
  transform: `translateY(${(1 - t) * risePx}px) scale(${0.94 + 0.06 * t})`,
});
