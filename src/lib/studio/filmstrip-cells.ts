import type { Frame } from "@/lib/studio/filmstrip";

export interface FilmstripCell {
  frame: Frame;
  left: number;
  width: number;
}

/**
 * Give every frame a source-time cell bounded halfway to its neighbours, then
 * project the visible part into pixels. The mapping depends on time, never on
 * a requested tile count, so zooming cannot swap or regroup thumbnails.
 */
export function filmstripCells(
  frames: Frame[],
  srcStart: number,
  srcEnd: number,
  widthPx: number,
): FilmstripCell[] {
  const sourceSpan = srcEnd - srcStart;
  if (frames.length === 0 || widthPx <= 0 || sourceSpan <= 0) return [];

  const cells: FilmstripCell[] = [];
  for (let index = 0; index < frames.length; index++) {
    const frame = frames[index];
    const previous = frames[index - 1];
    const next = frames[index + 1];
    const cellStart = previous
      ? (previous.time + frame.time) / 2
      : Number.NEGATIVE_INFINITY;
    const cellEnd = next
      ? (frame.time + next.time) / 2
      : Number.POSITIVE_INFINITY;
    const visibleStart = Math.max(srcStart, cellStart);
    const visibleEnd = Math.min(srcEnd, cellEnd);
    if (visibleEnd <= visibleStart) continue;
    cells.push({
      frame,
      left: ((visibleStart - srcStart) / sourceSpan) * widthPx,
      width: ((visibleEnd - visibleStart) / sourceSpan) * widthPx,
    });
  }
  return cells;
}
