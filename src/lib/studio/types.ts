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

export function newClipId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `clip-${crypto.randomUUID()}`;
  }
  return `clip-${Date.now()}-${Math.round(Math.random() * 1e6)}`;
}
