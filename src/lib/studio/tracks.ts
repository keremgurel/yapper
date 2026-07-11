import type { Overlay } from "@/lib/studio/types";

/**
 * Upper video tracks. Every overlay names the track it sits on: 0 is the lane
 * directly above the base, and a higher number composites over a lower one. A
 * track holds any number of overlays, as long as they don't overlap in time.
 *
 * Tracks are implicit: they exist because something is on them. Nothing here
 * stores a track, only reads one off the overlays.
 */

/** The highest track in use, or -1 when there are no overlays. */
export function topTrack(overlays: Overlay[]): number {
  let top = -1;
  for (const o of overlays) top = Math.max(top, o.track);
  return top;
}

/** How many upper tracks the timeline has to draw. */
export function trackCount(overlays: Overlay[]): number {
  return topTrack(overlays) + 1;
}

/** The overlays on one track, in the order they were added. */
export function overlaysOnTrack(overlays: Overlay[], track: number): Overlay[] {
  return overlays.filter((o) => o.track === track);
}

/** Two timeline spans share at least one instant. Touching edges do not. */
function spansCollide(
  aStart: number,
  aDuration: number,
  bStart: number,
  bDuration: number,
): boolean {
  return aStart < bStart + bDuration && bStart < aStart + aDuration;
}

/** Something other than `id` already occupies `track` over that span. */
export function trackOccupied(
  overlays: Overlay[],
  track: number,
  span: { id: string; start: number; duration: number },
): boolean {
  return overlays.some(
    (o) =>
      o.track === track &&
      o.id !== span.id &&
      spansCollide(o.start, o.duration, span.start, span.duration),
  );
}

/** Every span on `track` except `id`'s own, in timeline order. */
function busySpans(
  overlays: Overlay[],
  track: number,
  id: string,
): { start: number; end: number }[] {
  return overlays
    .filter((o) => o.track === track && o.id !== id)
    .map((o) => ({ start: o.start, end: o.start + o.duration }))
    .sort((a, b) => a.start - b.start);
}

/** The stretches of `track` a clip of `duration` could occupy, `id` aside. */
function freeGaps(
  overlays: Overlay[],
  track: number,
  span: { id: string; duration: number },
): { lo: number; hi: number }[] {
  const gaps: { lo: number; hi: number }[] = [];
  let prev = 0;
  for (const b of busySpans(overlays, track, span.id)) {
    if (b.start - prev >= span.duration)
      gaps.push({ lo: prev, hi: b.start - span.duration });
    prev = Math.max(prev, b.end);
  }
  gaps.push({ lo: prev, hi: Infinity });
  return gaps;
}

/**
 * Where a clip dragged to `start` may actually rest on `track`: the nearest
 * point inside a gap big enough to hold it. Clips on a track never overlap, so
 * a drag stops against its neighbour rather than sliding through it. There is
 * always somewhere to land, since the track runs on past its last clip.
 */
export function clampStartToTrack(
  overlays: Overlay[],
  track: number,
  span: { id: string; start: number; duration: number },
): number {
  const wanted = Math.max(0, span.start);
  let best = wanted;
  let bestGap = Infinity;
  for (const { lo, hi } of freeGaps(overlays, track, span)) {
    const landing = Math.min(Math.max(wanted, lo), hi);
    const gap = Math.abs(landing - wanted);
    if (gap < bestGap) {
      bestGap = gap;
      best = landing;
    }
  }
  return best;
}

/**
 * How far a clip's edges can be trimmed out on its own track before they meet
 * the neighbours. The mirror of `trimBounds` for the bottom track.
 */
export function overlayTrimBounds(
  overlays: Overlay[],
  overlay: Overlay,
): { min: number; max: number } {
  const end = overlay.start + overlay.duration;
  let min = 0;
  let max = Infinity;
  for (const b of busySpans(overlays, overlay.track, overlay.id)) {
    if (b.end <= overlay.start) min = Math.max(min, b.end);
    if (b.start >= end) max = Math.min(max, b.start);
  }
  return { min, max };
}

/**
 * The lowest track a new clip fits on, or a fresh one above them all. New media
 * joins an existing track when there is room for it, rather than growing the
 * stack for every addition.
 */
export function firstFreeTrack(
  overlays: Overlay[],
  span: { id: string; start: number; duration: number },
): number {
  let track = 0;
  while (trackOccupied(overlays, track, span)) track++;
  return track;
}

/**
 * Close the gaps left by emptied tracks, so track numbers stay 0..n-1 with
 * nothing blank in between. Relative stacking is preserved.
 */
export function compactTracks(overlays: Overlay[]): Overlay[] {
  const used = [...new Set(overlays.map((o) => o.track))].sort((a, b) => a - b);
  const rank = new Map(used.map((t, i) => [t, i]));
  return overlays.map((o) => {
    const next = rank.get(o.track) ?? 0;
    return next === o.track ? o : { ...o, track: next };
  });
}

/**
 * Move one overlay to another track. A move onto occupied timeline is refused
 * rather than silently stacking two clips into the same instant.
 *
 * The track it leaves stays, empty. Emptying a track by moving its last clip up
 * is a thing an editor does on purpose, and closing the lane up under the
 * pointer would undo the move you just made. Tracks are only closed up when one
 * is deleted outright, and the topmost lane vanishes on its own, since a track
 * only exists while something sits on it.
 */
export function moveToTrack(
  overlays: Overlay[],
  id: string,
  track: number,
): Overlay[] {
  const o = overlays.find((x) => x.id === id);
  if (!o) return overlays;
  const target = Math.max(0, track);
  if (target === o.track) return overlays;
  if (trackOccupied(overlays, target, o)) return overlays;
  return overlays.map((x) => (x.id === id ? { ...x, track: target } : x));
}

/**
 * Overlays in the order a renderer should paint them: bottom track first, so
 * the last one drawn is the one that wins. Ties keep their array order.
 */
export function paintOrder(overlays: Overlay[]): Overlay[] {
  return overlays
    .map((o, i) => ({ o, i }))
    .sort((a, b) => a.o.track - b.o.track || a.i - b.i)
    .map((e) => e.o);
}
