"use client";

import { useEffect, useState } from "react";
import { useReducedMotion } from "framer-motion";

/**
 * Steps through `items` on a timer, like a carousel, until the viewer takes
 * over: `choose` jumps to an item and stops the timer for good. Reduced motion
 * never starts it.
 */
export function useAutoAdvance<T>(items: readonly T[], intervalMs: number) {
  const [index, setIndex] = useState(0);
  const [manual, setManual] = useState(false);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (manual || reduce) return;
    const timer = window.setInterval(
      () => setIndex((i) => (i + 1) % items.length),
      intervalMs,
    );
    return () => window.clearInterval(timer);
  }, [manual, reduce, items.length, intervalMs]);

  const choose = (item: T) => {
    setManual(true);
    setIndex(Math.max(0, items.indexOf(item)));
  };

  return { current: items[index], choose, playing: !manual && !reduce };
}
