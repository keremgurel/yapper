import { clipDuration } from "@/lib/studio/clips";
import { spansOverlap } from "@/lib/studio/marquee";
import type { AudioTrack, Caption, Clip, Overlay } from "@/lib/studio/types";

/** A drag-select box, in the timeline content's pixel space (scroll folded in). */
export interface MarqueeBox {
  left: number;
  right: number;
}

/**
 * Which lanes the box reaches vertically. The caller resolves this from the DOM
 * (getBoundingClientRect per row) so the geometry below stays pure and testable.
 */
export interface MarqueeRowHits {
  base: boolean;
  caption: boolean;
  tracks: Set<number>;
  audio: Set<string>;
}

export interface MarqueeData {
  clips: Clip[];
  /** Timeline start (seconds) of each clip, index-aligned with `clips`. */
  clipOffsets: number[];
  overlays: Overlay[];
  captions: Caption[];
  /** A caption's timeline span; a degenerate (end <= start) one is skipped. */
  captionRange: (c: Caption) => { start: number; end: number };
  audioTracks: AudioTrack[];
}

export interface MarqueeSelection {
  clipIds: string[];
  overlayIds: string[];
  captionIds: string[];
  audioIds: string[];
}

/**
 * The ids a marquee box catches, per kind. An item is caught when its lane is
 * within the box vertically AND its timeline span overlaps the box's x-span.
 *
 * The box owns the whole selection: a kind whose lane it misses returns an
 * empty list, so a stale selection from before the drag can't be swept up by
 * the next Delete. Pure: pixels and offsets are already measured by the caller,
 * and the per-lane vertical hit-test is resolved into `rows` beforehand.
 */
export function marqueeSelection(
  box: MarqueeBox,
  padLeft: number,
  pxPerSec: number,
  rows: MarqueeRowHits,
  data: MarqueeData,
): MarqueeSelection {
  // A span of timeline seconds, converted to the box's content px.
  const xHit = (from: number, to: number) =>
    spansOverlap(
      padLeft + from * pxPerSec,
      padLeft + to * pxPerSec,
      box.left,
      box.right,
    );
  const clipIds = rows.base
    ? data.clips
        .filter((c, i) =>
          xHit(data.clipOffsets[i], data.clipOffsets[i] + clipDuration(c)),
        )
        .map((c) => c.id)
    : [];
  const overlayIds = data.overlays
    .filter(
      (o) => rows.tracks.has(o.track) && xHit(o.start, o.start + o.duration),
    )
    .map((o) => o.id);
  const captionIds = rows.caption
    ? data.captions
        .filter((c) => {
          const r = data.captionRange(c);
          return r.end > r.start && xHit(r.start, r.end);
        })
        .map((c) => c.id)
    : [];
  const audioIds = data.audioTracks
    .filter((a) => rows.audio.has(a.id) && xHit(a.start, a.start + a.duration))
    .map((a) => a.id);
  return { clipIds, overlayIds, captionIds, audioIds };
}
