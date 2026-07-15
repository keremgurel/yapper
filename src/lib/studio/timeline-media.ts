import type { AudioTrack } from "@/lib/studio/types";

/** A distinct piece of media on the timeline, whatever layer it sits on. */
export interface TimelineMedia {
  url: string;
  duration: number;
}

/**
 * Which media to load waveform peaks for: every distinct video already on the
 * timeline (they carry the audio you hear) plus each audio track's own file.
 * Deduped by URL, with the existing video entry winning when an audio track
 * happens to reuse a URL a video already contributes, so the same peaks are
 * never decoded twice.
 *
 * Filmstrips deliberately do NOT get the audio tracks: an audio-only file has no
 * frames to seek, so adding it to that pipeline would only burn time timing out.
 */
export function waveformMedia(
  video: TimelineMedia[],
  audioTracks: AudioTrack[],
): TimelineMedia[] {
  const seen = new Set(video.map((m) => m.url));
  const out = [...video];
  for (const a of audioTracks) {
    if (!a.url || a.duration <= 0 || seen.has(a.url)) continue;
    seen.add(a.url);
    out.push({ url: a.url, duration: a.duration });
  }
  return out;
}
