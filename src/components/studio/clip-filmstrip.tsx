"use client";

import { memo } from "react";
import type { Frame } from "@/lib/studio/filmstrip";

/**
 * Nearest frame by time. Frames are time-sorted, so this is a binary search:
 * zooming in adds tiles, and a linear scan per tile made zoom scale badly.
 */
function nearestFrame(frames: Frame[], t: number): Frame {
  let lo = 0;
  let hi = frames.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (frames[mid].time < t) lo = mid + 1;
    else hi = mid;
  }
  const at = frames[lo];
  const prev = frames[lo - 1];
  return prev && Math.abs(prev.time - t) <= Math.abs(at.time - t) ? prev : at;
}

// How much coarser (fewer, wider) tiles get while a zoom gesture is actively
// in flight. Every wheel step re-renders every visible clip's filmstrip at
// the new scale — the tile count (and thus <img> count) is the dominant cost
// of that re-render, so a rapid pinch/scroll draws far fewer, wider tiles and
// only sharpens back up once the gesture settles (see `coarse` below).
const ZOOM_TILE_COARSEN = 4;

/**
 * Renders a clip's thumbnails as sharp, fixed-width tiles across only the
 * visible slice of the track. Zooming in widens the slice, so more distinct
 * frames appear instead of a few thumbnails stretching and blurring.
 */
function ClipFilmstrip({
  frames,
  aspect,
  leftPx,
  widthPx,
  srcStart,
  srcEnd,
  height,
  coarse = false,
}: {
  frames: Frame[];
  aspect: number;
  leftPx: number;
  widthPx: number;
  srcStart: number;
  srcEnd: number;
  height: number;
  /** True while a zoom gesture is actively changing the scale. */
  coarse?: boolean;
}) {
  if (frames.length === 0 || widthPx <= 0) return null;
  const tileW = Math.max(24, Math.round(height * aspect));
  const effectiveTileW = coarse ? tileW * ZOOM_TILE_COARSEN : tileW;
  const tiles = Math.max(1, Math.round(widthPx / effectiveTileW));
  const tileWpx = widthPx / tiles;

  return (
    <span
      className="pointer-events-none absolute top-0 bottom-0 flex overflow-hidden"
      style={{ left: leftPx, width: widthPx }}
    >
      {Array.from({ length: tiles }, (_, k) => {
        const srcT = srcStart + ((k + 0.5) / tiles) * (srcEnd - srcStart);
        const f = nearestFrame(frames, srcT);
        return (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={k}
            src={f.src}
            alt=""
            draggable={false}
            style={{ width: tileWpx }}
            className="h-full shrink-0 object-cover"
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
