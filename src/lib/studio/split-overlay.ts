import { newOverlayId, type Overlay } from "@/lib/studio/types";

/** How close to an edge a cut is ignored, in seconds. Matches the audio split. */
const EPS = 0.05;

/**
 * Split each overlay in `ids` in two at edited-timeline position `t`. The left
 * half ends at the cut; the right half starts at `t`. For a video overlay the
 * right half advances its media in-point by the same amount, so the two halves
 * play the file continuously with no gap or repeat. An image overlay has no
 * timebase, so its in-point carries over unchanged (advancing it would be the
 * clip-with-src timebase bug). A cut within EPS of either edge, or aimed at an
 * overlay not in `ids`, is a no-op, so it can never make a zero-length sliver.
 */
export function splitOverlaysAt(
  overlays: Overlay[],
  ids: Set<string>,
  t: number,
): Overlay[] {
  return overlays.flatMap((o) => {
    if (!ids.has(o.id)) return [o];
    const local = t - o.start;
    if (local <= EPS || local >= o.duration - EPS) return [o];
    return [
      { ...o, id: newOverlayId(), duration: local },
      {
        ...o,
        id: newOverlayId(),
        start: t,
        duration: o.duration - local,
        sourceStart: o.kind === "image" ? o.sourceStart : o.sourceStart + local,
      },
    ];
  });
}
