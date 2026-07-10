"use client";

import type { Frame } from "@/lib/studio/filmstrip";

function nearestFrame(frames: Frame[], t: number): Frame {
  let best = frames[0];
  let bestD = Infinity;
  for (const f of frames) {
    const d = Math.abs(f.time - t);
    if (d < bestD) {
      bestD = d;
      best = f;
    }
  }
  return best;
}

/**
 * Renders a clip's thumbnails as sharp, fixed-width tiles across only the
 * visible slice of the track. Zooming in widens the slice, so more distinct
 * frames appear instead of a few thumbnails stretching and blurring.
 */
export default function ClipFilmstrip({
  frames,
  aspect,
  leftPx,
  widthPx,
  srcStart,
  srcEnd,
  height,
}: {
  frames: Frame[];
  aspect: number;
  leftPx: number;
  widthPx: number;
  srcStart: number;
  srcEnd: number;
  height: number;
}) {
  if (frames.length === 0 || widthPx <= 0) return null;
  const tileW = Math.max(24, Math.round(height * aspect));
  const tiles = Math.max(1, Math.round(widthPx / tileW));
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
