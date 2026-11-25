"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Seconds since the loop began, advancing on every animation frame while
 * `playing` and wrapping at `durationS`. A still (duration 0) stays at 0.
 * To start again for another look, remount the component that owns the clock.
 */
export function useLoopClock(durationS: number, playing: boolean): number {
  const [time, setTime] = useState(0);
  const elapsed = useRef(0);

  useEffect(() => {
    if (!playing || durationS <= 0) return;
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      elapsed.current = (elapsed.current + (now - last) / 1000) % durationS;
      last = now;
      setTime(elapsed.current);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, durationS]);

  return time;
}
