/** Shortest a trimmed clip may become, in seconds. */
export const MIN_TRIM = 0.1;

export interface TrimRange {
  /** Timeline position of the left edge, seconds. */
  start: number;
  /** Played length on the timeline, seconds. */
  duration: number;
  /** In-point into the clip's own media, seconds. */
  sourceStart: number;
}

/**
 * Drag the LEFT edge of a clip by `deltaSec` (positive drags right, shortening
 * it). The right edge stays put, so the start and the media in-point move
 * together while the out-point is fixed. Clamped so the clip never shrinks below
 * MIN_TRIM, never crosses `min` on the timeline (0:00 or a neighbour), and,
 * unless it is a still image, never pulls the in-point before the media's start.
 */
export function trimStartEdge(
  orig: TrimRange,
  deltaSec: number,
  opts: { min: number; isImage: boolean },
): TrimRange {
  let d = deltaSec;
  d = Math.min(d, orig.duration - MIN_TRIM);
  d = Math.max(d, opts.min - orig.start);
  if (!opts.isImage) d = Math.max(d, -orig.sourceStart);
  return {
    start: orig.start + d,
    duration: orig.duration - d,
    sourceStart: opts.isImage ? orig.sourceStart : orig.sourceStart + d,
  };
}

/**
 * Drag the RIGHT edge of a clip by `deltaSec` (positive drags right, lengthening
 * it). Only the duration changes. Clamped so the clip never shrinks below
 * MIN_TRIM, never runs past `max` on the timeline (a neighbour), and never asks
 * for more media than the source has (`fullDuration`). Pass Infinity for a bound
 * that does not apply (no neighbour, or an image with no media length).
 */
export function trimEndEdge(
  orig: TrimRange,
  deltaSec: number,
  opts: { max: number; fullDuration: number },
): TrimRange {
  let d = deltaSec;
  d = Math.max(d, MIN_TRIM - orig.duration);
  if (Number.isFinite(opts.fullDuration)) {
    d = Math.min(d, opts.fullDuration - (orig.sourceStart + orig.duration));
  }
  if (Number.isFinite(opts.max)) {
    d = Math.min(d, opts.max - (orig.start + orig.duration));
  }
  return {
    start: orig.start,
    duration: orig.duration + d,
    sourceStart: orig.sourceStart,
  };
}
