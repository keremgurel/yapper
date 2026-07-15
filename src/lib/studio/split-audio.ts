import { newAudioId, type AudioTrack } from "@/lib/studio/types";

/** How close to an edge a cut is ignored, in seconds. Matches the overlay split. */
const EPS = 0.05;

/**
 * Split the audio clip `id` in two at edited-timeline position `t`. The left
 * half keeps the clip's in-point and ends at the cut; the right half starts at
 * `t` and advances its media in-point by the same amount, so the two halves
 * play the underlying file continuously with no gap or repeat. A cut within
 * EPS of either edge (or aimed at a clip that isn't `id`) is a no-op, so it can
 * never make a zero-length sliver. Everything else about the clip carries over,
 * including its full media length.
 */
export function splitAudioAt(
  tracks: AudioTrack[],
  id: string,
  t: number,
): AudioTrack[] {
  return tracks.flatMap((a) => {
    if (a.id !== id) return [a];
    const local = t - a.start;
    if (local <= EPS || local >= a.duration - EPS) return [a];
    return [
      { ...a, id: newAudioId(), duration: local },
      {
        ...a,
        id: newAudioId(),
        start: t,
        duration: a.duration - local,
        sourceStart: a.sourceStart + local,
      },
    ];
  });
}
