/** A media source a clip can reference (its own video, appended to the main
 * track). When a clip has no `src`, it uses the project's base source. */
export interface MediaRef {
  url: string;
  kind: "video" | "image";
  name: string;
  duration: number;
  width?: number;
  height?: number;
}

/** A kept range of a source, in that source's seconds. The edited timeline is
 * the ordered concatenation of clips; gaps between same-source clips are removed
 * regions. `src` set = the clip plays its own appended media, not the base. */
export interface Clip {
  id: string;
  start: number;
  end: number;
  src?: MediaRef;
}

export interface StudioSource {
  url: string;
  name: string;
  duration: number;
  width?: number;
  height?: number;
  /** "image" bases have no audio/video element and use a synthetic clock. */
  kind?: "video" | "image";
}

/** A media item in the library (uploaded photo or video). */
export interface MediaAsset {
  id: string;
  kind: "video" | "image";
  url: string;
  name: string;
  duration: number; // seconds (default for images)
  width?: number;
  height?: number;
}

/**
 * A clip on an upper video track, composited over the base track (a higher
 * track wins). Carries its own source in-point so a segment of the recording
 * can be lifted up as a cutaway. Several overlays share one track as long as
 * they don't overlap in time; see `lib/studio/tracks.ts`.
 */
export interface Overlay {
  id: string;
  kind: "video" | "image";
  url: string;
  name: string;
  /** Which upper track it sits on. 0 is the lane just above the base. */
  track: number;
  start: number; // edited-timeline seconds (position on its track)
  duration: number;
  sourceStart: number; // in-point into its own media, seconds
  hidden?: boolean; // hidden (not composited)
  muted?: boolean; // audio muted
  // Position + size as fractions of the preview stage (default full-frame).
  x?: number;
  y?: number;
  w?: number;
  h?: number;
}

export interface OverlayRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function newMediaId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `media-${crypto.randomUUID()}`;
  }
  return `media-${Date.now()}-${Math.round(Math.random() * 1e6)}`;
}

export function newOverlayId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `ov-${crypto.randomUUID()}`;
  }
  return `ov-${Date.now()}-${Math.round(Math.random() * 1e6)}`;
}

/** An audio clip placed on its own track, positioned on the edited timeline. */
export interface AudioTrack {
  id: string;
  name: string;
  url: string;
  duration: number;
  start: number; // edited-timeline seconds
  muted: boolean;
}

/**
 * A token identifying one continuous gesture (a drag, a trim). Passed to the
 * undoable setters so every event in the gesture collapses into a single undo
 * step, while two separate gestures stay separately undoable.
 */
export function newGestureId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `gesture-${crypto.randomUUID()}`;
  }
  return `gesture-${Date.now()}-${Math.round(Math.random() * 1e6)}`;
}

export function newAudioId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `aud-${crypto.randomUUID()}`;
  }
  return `aud-${Date.now()}-${Math.round(Math.random() * 1e6)}`;
}

/** Display-only casing for a caption. Lives here so a Caption can override it. */
export type CaptionCase = "none" | "lower" | "upper";

/** A transcribed token (word or short phrase) with source timestamps. */
export interface Word {
  id: string;
  text: string;
  start: number;
  end: number;
}

export function newWordId(i: number): string {
  return `w-${i}`;
}

export function newClipId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `clip-${crypto.randomUUID()}`;
  }
  return `clip-${Date.now()}-${Math.round(Math.random() * 1e6)}`;
}

/** A caption segment. Anchored in SOURCE seconds (like the transcript words) so
 * it follows edits — its edited-timeline position is derived from the clips.
 * x/y/w/scale are optional per-caption overrides of the global caption style. */
export interface Caption {
  id: string;
  text: string;
  sourceStart: number;
  sourceEnd: number;
  x?: number;
  y?: number;
  w?: number; // box width override (fraction of stage)
  scale?: number;
  // Per-caption style overrides. When set, they win over the global caption
  // style, so a single caption can be recased/refont without touching the rest.
  fontFamily?: string;
  textCase?: CaptionCase;
}

export function newCaptionId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `cap-${crypto.randomUUID()}`;
  }
  return `cap-${Date.now()}-${Math.round(Math.random() * 1e6)}`;
}
