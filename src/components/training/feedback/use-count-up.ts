"use client";

import { useEffect, useState } from "react";
import { useReducedMotion } from "framer-motion";

const easeOut = (t: number) => 1 - (1 - t) ** 3;

/**
 * Counts from zero to `value` once `active` turns true, so a number arrives
 * together with the gauge that draws it. Jumps straight to the value under
 * reduced motion. `decimals` keeps a figure like 11.5 from flickering through
 * long fractions on the way.
 */
export function useCountUp(
  value: number,
  active: boolean,
  { duration = 1100, decimals = 0 } = {},
): number {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (!active || reduced) return;
    let frame = 0;
    const started = performance.now();
    const step = (now: number) => {
      const progress = Math.min(1, (now - started) / duration);
      const factor = 10 ** decimals;
      setShown(Math.round(value * easeOut(progress) * factor) / factor);
      if (progress < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [active, reduced, value, duration, decimals]);
  return reduced ? value : shown;
}
