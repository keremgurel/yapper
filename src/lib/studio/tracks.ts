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
 * rather than silently stacking two clips into the same instant, and the track
 * it left is closed up if it was the last one there.
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
  return compactTracks(
    overlays.map((x) => (x.id === id ? { ...x, track: target } : x)),
  );
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
