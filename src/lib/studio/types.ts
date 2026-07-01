/** A kept range of the source video, in source seconds. The edited timeline is
 * the ordered concatenation of clips; gaps between clips are removed regions. */
export interface Clip {
  id: string;
  start: number;
  end: number;
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
 * A clip on an upper video track, composited full-frame over the base track
 * (top track wins). Carries its own source in-point so a segment of the
 * recording can be lifted up as a cutaway.
 */
export interface Overlay {
  id: string;
  kind: "video" | "image";
  url: string;
  name: string;
  start: number; // edited-timeline seconds (position on its track)
  duration: number;
  sourceStart: number; // in-point into its own media, seconds
  hidden?: boolean; // track hidden (not composited)
  muted?: boolean; // track audio muted
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

export function newAudioId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `aud-${crypto.randomUUID()}`;
  }
  return `aud-${Date.now()}-${Math.round(Math.random() * 1e6)}`;
}

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
