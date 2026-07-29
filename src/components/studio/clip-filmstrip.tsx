"use client";

import { memo } from "react";
import type { Frame } from "@/lib/studio/filmstrip";
import { filmstripCells } from "@/lib/studio/filmstrip-cells";

/**
 * Each frame owns a fixed source-time cell, bounded halfway to its neighbors.
 * Zoom only scales those same cells: it never changes the tile count, swaps a
 * frame for a different timestamp, or snaps between coarse/fine layouts.
 */
function ClipFilmstrip({
  frames,
  leftPx,
  widthPx,
  srcStart,
  srcEnd,
}: {
  frames: Frame[];
  leftPx: number;
  widthPx: number;
  srcStart: number;
  srcEnd: number;
}) {
  const cells = filmstripCells(frames, srcStart, srcEnd, widthPx);
  if (cells.length === 0) return null;

  return (
    <span
      className="pointer-events-none absolute top-0 bottom-0 overflow-hidden"
      style={{ left: leftPx, width: widthPx }}
    >
      {cells.map(({ frame, left, width }) => {
        return (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={`${frame.time}:${frame.src}`}
            src={frame.src}
            alt=""
            draggable={false}
            style={{ left, width: Math.max(1, width) }}
            className="absolute top-0 h-full object-cover"
          />
        );
      })}
    </span>
  );
}

/**
 * Memoized: every prop derives from the clip, zoom, and scroll, never from the
 * playhead time, so it must not re-render on every playback frame. That
 * per-frame thumbnail re-render was a real source of stutter in the app.
 */
export default memo(ClipFilmstrip);
