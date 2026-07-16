import { sourceToTimeline } from "@/lib/studio/clips";
import { fitBox, mediaAspect } from "@/lib/studio/overlay-box";
import { MIN_SPAN_SEC, type PlacedSpan } from "@/lib/studio/overlay-plan";
import { firstFreeTrack } from "@/lib/studio/tracks";
import type { Clip, MediaAsset, Overlay } from "@/lib/studio/types";

/** An overlay to add, minus its id (the caller mints it), with its source span. */
export interface PlannedOverlay {
  overlay: Omit<Overlay, "id">;
  span: PlacedSpan;
}

/**
 * Lay AI-chosen cutaway spans onto upper tracks. The spans arrive in the
 * recording's seconds (that is what the transcript is anchored in) and are
 * mapped through the clips to edited-timeline seconds, so a span over speech
 * that has since been cut collapses to nothing and is dropped rather than
 * landing arbitrarily. A video's duration is clamped to its own media length;
 * an image runs for the whole span. Each overlay is packed onto the lowest free
 * track, accounting for the ones already placed earlier in the same batch.
 *
 * Pure: ids are minted by the caller so a state updater can stay pure.
 */
export function planSpanOverlays(
  spans: PlacedSpan[],
  existing: Overlay[],
  clips: Clip[],
  mediaAssets: MediaAsset[],
  aspect: number,
): PlannedOverlay[] {
  const out: PlannedOverlay[] = [];
  let taken = existing;
  for (const span of spans) {
    const asset = mediaAssets.find((m) => m.name === span.file);
    if (!asset) continue;
    const start = sourceToTimeline(clips, span.sourceStart);
    const end = sourceToTimeline(clips, span.sourceEnd);
    if (end - start < MIN_SPAN_SEC) continue;
    const duration =
      asset.kind === "video"
        ? Math.min(end - start, asset.duration)
        : end - start;
    const overlay: Omit<Overlay, "id"> = {
      kind: asset.kind,
      url: asset.url,
      name: asset.name,
      track: firstFreeTrack(taken, { id: "new", start, duration }),
      start,
      duration,
      sourceStart: 0,
      muted: true,
      ...fitBox(mediaAspect(asset), aspect),
    };
    out.push({ overlay, span });
    // The accumulating list only needs an id for the next track-occupancy check;
    // a synthetic one suffices since the caller mints the real id.
    taken = [...taken, { ...overlay, id: `planned-${out.length}` }];
  }
  return out;
}
