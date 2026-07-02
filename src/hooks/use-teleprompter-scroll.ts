"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Words-per-minute presets the speed control steps through. Teleprompter speed
 * is most intuitive as reading pace, not pixels/sec. */
export const WPM_PRESETS = [100, 130, 160, 200] as const;
const DEFAULT_WPM = 130;
/** Rough px of scroll per word at the overlay's font size — tuned by feel, not
 * exact; the creator adjusts speed live anyway. */
const PX_PER_WORD = 9;

/**
 * Auto-scroll engine for the teleprompter overlay. One concern: advance a
 * scroll position over time at a chosen reading pace, with play/pause/reset and
 * a live speed control. Returns a ref to attach to the scrolling element.
 */
export function useTeleprompterScroll() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [wpm, setWpm] = useState<number>(DEFAULT_WPM);
  const [running, setRunning] = useState(false);

  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number | null>(null);
  // Keep sub-pixel progress so slow speeds still advance smoothly.
  const offsetRef = useRef(0);
  const wpmRef = useRef(wpm);
  useEffect(() => {
    wpmRef.current = wpm;
  }, [wpm]);

  const stopLoop = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    lastTsRef.current = null;
  }, []);

  // The loop lives in a ref so each frame can reschedule itself without a
  // self-referencing useCallback (which the compiler rejects).
  const tickRef = useRef<(ts: number) => void>(() => {});
  const schedule = useCallback(() => {
    rafRef.current = requestAnimationFrame((t) => tickRef.current(t));
  }, []);

  const tick = useCallback(
    (ts: number) => {
      const el = scrollRef.current;
      if (!el) {
        // No element to scroll — clear the loop so a later play() isn't blocked
        // forever by a stale rafRef.
        stopLoop();
        return;
      }
      if (lastTsRef.current !== null) {
        const dt = (ts - lastTsRef.current) / 1000;
        const pxPerSec = (wpmRef.current / 60) * PX_PER_WORD;
        offsetRef.current += pxPerSec * dt;
        el.scrollTop = offsetRef.current;
        // Stop at the bottom so we don't spin forever once the script is read.
        if (el.scrollTop + el.clientHeight >= el.scrollHeight - 1) {
          stopLoop();
          setRunning(false);
          return;
        }
      }
      lastTsRef.current = ts;
      schedule();
    },
    [stopLoop, schedule],
  );

  useEffect(() => {
    tickRef.current = tick;
  }, [tick]);

  const play = useCallback(() => {
    if (rafRef.current !== null) return;
    setRunning(true);
    schedule();
  }, [schedule]);

  const pause = useCallback(() => {
    stopLoop();
    setRunning(false);
  }, [stopLoop]);

  const reset = useCallback(() => {
    stopLoop();
    setRunning(false);
    offsetRef.current = 0;
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [stopLoop]);

  useEffect(() => stopLoop, [stopLoop]);

  return { scrollRef, wpm, setWpm, running, play, pause, reset };
}
