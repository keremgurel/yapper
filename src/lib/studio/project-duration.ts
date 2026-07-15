import { totalDuration } from "@/lib/studio/clips";
import type { AudioTrack, Clip, Overlay } from "@/lib/studio/types";

/**
 * Length of the edited timeline: whichever layer runs longest. The bottom track
 * is only the lowest layer, so it doesn't get to cut the project short — an
 * overlay or audio clip that outlasts it still plays and still exports, and a
 * project with no bottom track at all is still a project.
 *
 * A hidden overlay is composited nowhere (frame plan, export, and audio mix all
 * skip it), so it must not pad the timeline with trailing empty frames. A muted
 * audio track is the audio analogue: it makes no sound (the mix skips it) and
 * has no picture, so it must not pad the timeline either. A muted but visible
 * overlay still renders, so it does still count.
 */
export function projectDuration(
  clips: Clip[],
  overlays: Overlay[],
  audioTracks: AudioTrack[],
): number {
  let end = totalDuration(clips);
  for (const o of overlays) {
    if (o.hidden) continue;
    end = Math.max(end, o.start + o.duration);
  }
  for (const a of audioTracks) {
    if (a.muted) continue;
    end = Math.max(end, a.start + a.duration);
  }
  return end;
}
