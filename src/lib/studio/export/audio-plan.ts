import { clipDuration } from "@/lib/studio/clips";
import type {
  AudioTrack,
  Clip,
  Overlay,
  StudioSource,
} from "@/lib/studio/types";

/** One source slice the export plays: `buffer[offset .. offset+length]` at timeline `when`. */
export interface AudioPlacement {
  url: string;
  /** Timeline seconds at which this slice starts. */
  when: number;
  /** In-point into the source media, seconds. */
  offset: number;
  /** How many seconds of the source to play. */
  length: number;
}

export interface AudioPlanInput {
  /** Media for bottom-track clips without their own `src`. Null once removed. */
  source: StudioSource | null;
  clips: Clip[];
  overlays: Overlay[];
  audioTracks: AudioTrack[];
  baseMuted: boolean;
}

/**
 * The audio bed as a flat list of source slices, in the order the renderer
 * schedules them: the bottom track's clips, then unmuted visible video
 * overlays, then unmuted audio tracks. Mirrors exactly what the preview mixes.
 *
 * Pure: it decides only WHICH slices play and WHERE, never decoding anything, so
 * the OfflineAudioContext stays confined to `mixAudio`. A slice that starts at
 * or past `duration`, or has no length, is inaudible and dropped here. A buffer
 * that fails to decode is the renderer's concern, so an empty plan means silence
 * but a non-empty plan does not guarantee sound.
 */
export function planAudioMix(
  input: AudioPlanInput,
  duration: number,
): AudioPlacement[] {
  const { source, clips, overlays, audioTracks, baseMuted } = input;
  const out: AudioPlacement[] = [];
  const add = (url: string, when: number, offset: number, length: number) => {
    if (length <= 0 || when >= duration) return;
    out.push({ url, when, offset, length });
  };

  // Bottom track: each clip plays its own source range at its timeline position.
  // The cursor advances for every clip, image or muted-source included, so a
  // silent clip still holds its slot and the clips after it stay in place.
  let cursor = 0;
  if (!baseMuted) {
    for (const clip of clips) {
      const url = clip.src?.url ?? source?.url;
      const kind = clip.src?.kind ?? source?.kind ?? "video";
      const len = clipDuration(clip);
      if (url && kind !== "image") add(url, cursor, clip.start, len);
      cursor += len;
    }
  }

  // Overlay audio: only unmuted, visible video overlays contribute. Mirror the
  // preview, where an overlay <video> is muted by default (muted ?? true), so
  // an overlay whose flag was never set stays silent here too.
  for (const o of overlays) {
    const muted = o.muted ?? true;
    if (o.hidden || muted || o.kind !== "video") continue;
    add(o.url, o.start, o.sourceStart, o.duration);
  }

  // Extra audio tracks, each from its own (possibly trimmed) in-point.
  for (const t of audioTracks) {
    if (t.muted) continue;
    add(t.url, t.start, t.sourceStart, t.duration);
  }

  return out;
}
