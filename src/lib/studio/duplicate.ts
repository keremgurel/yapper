import { firstFreeTrack, trackOccupied } from "@/lib/studio/tracks";
import type { Overlay } from "@/lib/studio/types";

/**
 * Where a duplicated overlay should sit: immediately after the original, keeping
 * its own track when that lane is free right after it (the natural spot), and
 * otherwise the lowest track that has room. The copy keeps everything else about
 * the original (media, crop, size); only its position moves, so it never lands
 * exactly on top of the source.
 */
export function duplicatedOverlayPosition(
  overlays: Overlay[],
  original: Overlay,
): { start: number; track: number } {
  const start = original.start + original.duration;
  const span = {
    id: `${original.id}-copy`,
    start,
    duration: original.duration,
  };
  const track = trackOccupied(overlays, original.track, span)
    ? firstFreeTrack(overlays, span)
    : original.track;
  return { start, track };
}
