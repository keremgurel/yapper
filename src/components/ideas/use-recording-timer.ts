"use client";

import { useEffect, useState } from "react";

/** Elapsed seconds of the current take; only meaningful while recording. */
export function useRecordingTimer(recording: boolean): number {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (!recording) return;
    const started = Date.now();
    const tick = () => setSeconds(Math.floor((Date.now() - started) / 1_000));
    // The first tick zeroes the display for a new take; state is never set
    // synchronously in the effect body, only from these scheduled callbacks.
    const first = window.requestAnimationFrame(tick);
    const timer = window.setInterval(tick, 250);
    return () => {
      window.cancelAnimationFrame(first);
      window.clearInterval(timer);
    };
  }, [recording]);

  return seconds;
}

export function durationLabel(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}
