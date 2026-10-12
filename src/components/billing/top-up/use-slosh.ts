"use client";

import { useEffect, useLayoutEffect, useRef } from "react";

const STEP = 1 / 120;
const DT_MAX = 0.05;
const STIFFNESS = 380;
const DAMPING_RATIO = 0.22;
const TILT_GAIN = 0.05;
const TILT_MAX = 14;

/**
 * Drives a liquid surface toward `target` (0 to 100) with an underdamped
 * spring, so a new level overshoots and settles instead of snapping. Calls
 * `paint(level, tiltDeg)` every frame while moving and stops when at rest.
 * Reduced motion jumps straight to the target with no tilt.
 *
 * Adapted from React Bits' SloshGauge (reactbits.dev/c/micro/slosh-gauge).
 */
export function useSlosh(
  target: number,
  paint: (level: number, tiltDeg: number) => void,
) {
  const sim = useRef({ x: target, v: 0, raf: 0, last: 0 });
  const paintRef = useRef(paint);
  useLayoutEffect(() => {
    paintRef.current = paint;
  }, [paint]);

  useEffect(() => {
    const s = sim.current;
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduce) {
      s.x = target;
      s.v = 0;
      paintRef.current(target, 0);
      return;
    }
    const damping = 2 * DAMPING_RATIO * Math.sqrt(STIFFNESS);
    const tick = (now: number) => {
      const dt = s.last ? Math.min((now - s.last) / 1000, DT_MAX) : STEP;
      s.last = now;
      for (let n = Math.ceil(dt / STEP), h = dt / n; n > 0; n -= 1) {
        s.v = s.v * Math.exp(-damping * h) + STIFFNESS * (target - s.x) * h;
        s.x = Math.min(100, Math.max(0, s.x + s.v * h));
      }
      const tilt = Math.max(-TILT_MAX, Math.min(TILT_MAX, s.v * TILT_GAIN));
      const resting = Math.abs(target - s.x) < 0.05 && Math.abs(s.v) < 1;
      if (resting) {
        s.x = target;
        s.v = 0;
        s.raf = 0;
        s.last = 0;
        paintRef.current(target, 0);
        return;
      }
      paintRef.current(s.x, tilt);
      s.raf = requestAnimationFrame(tick);
    };
    cancelAnimationFrame(s.raf);
    s.last = 0;
    s.raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(s.raf);
  }, [target]);
}
