import { captionTimelineRange, type CaptionStyle } from "@/lib/studio/captions";
import { timelineToClip, totalDuration } from "@/lib/studio/clips";
import { FULL_CROP } from "@/lib/studio/crop";
import { paintOrder } from "@/lib/studio/tracks";
import type {
  Caption,
  CaptionCase,
  Clip,
  Overlay,
  OverlayRect,
  StudioSource,
} from "@/lib/studio/types";

/** The base-track frame to show at edited-timeline time `t`. */
export interface BaseFrame {
  url: string;
  kind: "video" | "image";
  /** Time into that url's own media, in seconds. */
  sourceTime: number;
}

/** An overlay to composite at time `t`, with its box as stage fractions. */
export interface OverlayFrame {
  id: string;
  url: string;
  kind: "video" | "image";
  sourceTime: number;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Which part of its media to sample, in media fractions. */
  crop: OverlayRect;
}

/** The caption to draw at time `t`, already merged with the global style. */
export interface CaptionFrame {
  text: string;
  x: number;
  y: number;
  w: number;
  scale: number;
  fontFamily: string;
  textCase: CaptionCase;
}

/**
 * Which base source (and source-time) plays at edited-timeline time `t`, or
 * null when nothing does: the bottom track is empty, `t` is past its end (the
 * layers above it run longer), or its media is gone. `timelineToClip` clamps to
 * the last clip, so the past-the-end case has to be checked here — otherwise
 * the final frame would freeze on screen for the rest of the export.
 */
export function baseAt(
  clips: Clip[],
  source: StudioSource | null,
  t: number,
): BaseFrame | null {
  if (t >= totalDuration(clips)) return null;
  const hit = timelineToClip(clips, t);
  if (!hit) return null;
  const ref = clips[hit.index].src;
  const url = ref?.url ?? source?.url;
  if (!url) return null;
  return {
    url,
    kind: ref?.kind ?? source?.kind ?? "video",
    sourceTime: hit.sourceTime,
  };
}

/** Overlays active at `t`, in paint order (later entries render on top). */
export function overlaysAt(overlays: Overlay[], t: number): OverlayFrame[] {
  const out: OverlayFrame[] = [];
  for (const o of paintOrder(overlays)) {
    if (o.hidden) continue;
    const local = t - o.start;
    if (local < 0 || local >= o.duration) continue;
    out.push({
      id: o.id,
      url: o.url,
      kind: o.kind,
      sourceTime: o.sourceStart + local,
      x: o.x ?? 0,
      y: o.y ?? 0,
      w: o.w ?? 1,
      h: o.h ?? 1,
      crop: o.crop ?? FULL_CROP,
    });
  }
  return out;
}

/** The caption visible at `t`, merged with the global style, or null. */
export function captionAt(
  clips: Clip[],
  captions: Caption[],
  style: CaptionStyle,
  t: number,
): CaptionFrame | null {
  const active = captions.find((c) => {
    if (c.text.trim().length === 0) return false; // matches the .srt survival test
    const r = captionTimelineRange(clips, c);
    return r.end > r.start && t >= r.start && t < r.end;
  });
  if (!active) return null;
  return {
    text: active.text,
    x: active.x ?? style.x,
    y: active.y ?? style.y,
    w: active.w ?? style.width,
    scale: active.scale ?? style.fontScale,
    fontFamily: active.fontFamily ?? style.fontFamily,
    textCase: active.textCase ?? style.textCase,
  };
}
