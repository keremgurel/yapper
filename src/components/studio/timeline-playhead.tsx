"use client";

import { useSyncExternalStore } from "react";
import type { TimelineClock } from "@/lib/studio/timeline-clock";

/**
 * The moving red line. It subscribes to the per-frame clock directly instead
 * of taking the time as a prop, so playback only re-renders this one small
 * component every frame — not the ~1000-line timeline tree around it.
 */
export default function TimelinePlayhead({
  clock,
  pxPerSec,
  padLeft,
}: {
  clock: TimelineClock;
  pxPerSec: number;
  padLeft: number;
}) {
  const time = useSyncExternalStore(clock.subscribe, clock.get);
  const x = time * pxPerSec + padLeft;

  return (
    <div
      className="pointer-events-none absolute top-0 bottom-0 z-10 w-0.5 bg-red-500"
      style={{ left: x }}
    >
      <span className="absolute -top-0.5 left-1/2 h-2 w-2 -translate-x-1/2 rounded-full bg-red-500" />
    </div>
  );
}
