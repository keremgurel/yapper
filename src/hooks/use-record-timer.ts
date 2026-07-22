"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * A 3-2-1 style pre-roll. `start(from, onDone)` counts down one per second and
 * fires `onDone` when it reaches zero; `count` is the number to flash on camera
 * (null when idle). setState happens only in timeout callbacks, so the React
 * Compiler lint stays happy, and the timeout is cleared on unmount or cancel.
 */
export function useCountdown() {
  const [count, setCount] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancel = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    setCount(null);
  }, []);

  const start = useCallback((from: number, onDone: () => void) => {
    let n = from;
    setCount(n);
    const tick = () => {
      n -= 1;
      if (n <= 0) {
        timerRef.current = null;
        setCount(null);
        onDone();
        return;
      }
      setCount(n);
      timerRef.current = setTimeout(tick, 1000);
    };
    timerRef.current = setTimeout(tick, 1000);
  }, []);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  return { count, start, cancel };
}

/**
 * Seconds elapsed while `running` is true, resetting to 0 each time a run
 * starts. Derived from a start timestamp so it stays accurate across tab
 * throttling, and it only setStates inside the interval callback (never in the
 * effect body) to satisfy the React Compiler lint. Returns 0 whenever idle.
 */
export function useElapsedSeconds(running: boolean, sessionId = 0): number {
  const [seconds, setSeconds] = useState(0);
  // ms banked from earlier run segments in this session (pause/resume), plus the
  // start of the current segment; the session id resets the bank for a new take.
  const accRef = useRef(0);
  const startRef = useRef(0);
  const sessionRef = useRef(sessionId);

  useEffect(() => {
    if (sessionRef.current !== sessionId) {
      sessionRef.current = sessionId;
      accRef.current = 0;
    }
    if (!running) return;
    startRef.current = Date.now();
    // setState only in callbacks (never the effect body / render) for the lint.
    const update = () =>
      setSeconds(
        Math.floor((accRef.current + (Date.now() - startRef.current)) / 1000),
      );
    const raf = requestAnimationFrame(update);
    const id = setInterval(update, 250);
    return () => {
      cancelAnimationFrame(raf);
      clearInterval(id);
      // Bank this segment so a resume continues from here rather than from 0.
      accRef.current += Date.now() - startRef.current;
    };
  }, [running, sessionId]);

  return seconds;
}

/** Seconds as m:ss for the on-camera timer (e.g. 75 -> "1:15"). */
export function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
