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
