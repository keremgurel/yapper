export interface ClipSpan {
  leftPx: number;
  widthPx: number;
  srcA: number;
  srcB: number;
}

/**
 * Intersect a clip (placed at `clipLeftSec` on the timeline, covering source
 * range [srcStart, srcEnd]) with the visible window, mapping the visible slice
 * back to source seconds. Returns null when the clip is fully off-screen, so a
 * track only renders frames/waveform for what's actually on screen.
 */
export function visibleSpan(
  clipLeftSec: number,
  clipDur: number,
  srcStart: number,
  srcEnd: number,
  visStartSec: number,
  visEndSec: number,
  pxPerSec: number,
): ClipSpan | null {
  if (clipDur <= 0) return null;
  const a = Math.max(clipLeftSec, visStartSec);
  const b = Math.min(clipLeftSec + clipDur, visEndSec);
  if (b <= a) return null;
  const fracA = (a - clipLeftSec) / clipDur;
  const fracB = (b - clipLeftSec) / clipDur;
  return {
    leftPx: (a - clipLeftSec) * pxPerSec,
    widthPx: (b - a) * pxPerSec,
    srcA: srcStart + fracA * (srcEnd - srcStart),
    srcB: srcStart + fracB * (srcEnd - srcStart),
  };
}
