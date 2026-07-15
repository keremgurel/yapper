import { clipDuration } from "@/lib/studio/clips";
import { projectDuration } from "@/lib/studio/project-duration";
import { extractPcm } from "@/lib/studio/audio/extract-pcm";
import type { ExportInput } from "@/lib/studio/export/types";

const SAMPLE_RATE = 48_000;
const CHANNELS = 2;

/**
 * Render the full audio bed to a single buffer by replaying, on an offline
 * context, exactly what the preview mixes: each clip's slice of its source, plus
 * unmuted overlay audio and unmuted audio tracks, each at its timeline position.
 * Returns null when there is nothing audible (e.g. an image-only project).
 */
export async function mixAudio(
  input: ExportInput,
): Promise<AudioBuffer | null> {
  const { source, clips, overlays, audioTracks, baseMuted } = input;
  const duration = projectDuration(clips, overlays, audioTracks);
  if (duration <= 0) return null;

  const ctx = new OfflineAudioContext(
    CHANNELS,
    Math.ceil(duration * SAMPLE_RATE),
    SAMPLE_RATE,
  );

  const decoded = new Map<string, AudioBuffer | null>();
  const decode = async (url: string): Promise<AudioBuffer | null> => {
    if (decoded.has(url)) return decoded.get(url) ?? null;
    // Preferred: mp4box demux + WebCodecs, which is gapless. Web Audio's
    // decodeAudioData drops chunks on multi-track camera files, so a plain
    // decode here would ship an export whose audio is missing the same seconds
    // the transcript was. Fall back to decodeAudioData only for formats
    // WebCodecs can't handle (e.g. an added mp3/wav track).
    let buffer: AudioBuffer | null = null;
    try {
      const { channels, sampleRate } = await extractPcm(url);
      const length = channels[0]?.length ?? 0;
      if (length > 0) {
        buffer = ctx.createBuffer(channels.length, length, sampleRate);
        for (let c = 0; c < channels.length; c++) {
          buffer.copyToChannel(new Float32Array(channels[c]), c);
        }
      }
      decoded.set(url, buffer);
      return buffer;
    } catch {
      // WebCodecs path unavailable for this URL — fall through to Web Audio.
    }
    // Fetch failures (network / CORS / 404) must NOT be swallowed — doing so
    // would silently drop a track and ship a muted export. Only a genuine
    // decode failure on fetched bytes (a valid file with no audio track) is
    // allowed to contribute nothing.
    let bytes: ArrayBuffer;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      bytes = await res.arrayBuffer();
    } catch (e) {
      throw new Error(
        `Couldn't load audio for export (check media CORS): ${
          e instanceof Error ? e.message : String(e)
        }`,
      );
    }
    try {
      buffer = await ctx.decodeAudioData(bytes);
    } catch {
      buffer = null; // Valid file, no decodable audio track — contributes nothing.
    }
    decoded.set(url, buffer);
    return buffer;
  };

  let scheduled = 0;
  const schedule = (
    buffer: AudioBuffer,
    when: number,
    offset: number,
    length: number,
  ) => {
    if (length <= 0 || when >= duration) return;
    const node = ctx.createBufferSource();
    node.buffer = buffer;
    node.connect(ctx.destination);
    node.start(when, Math.max(0, offset), Math.min(length, duration - when));
    scheduled += 1;
  };

  // Bottom track: each clip plays its own source range at its timeline position.
  // A muted bottom track is as silent here as it is in the preview.
  let cursor = 0;
  if (!baseMuted) {
    for (const clip of clips) {
      const url = clip.src?.url ?? source?.url;
      const kind = clip.src?.kind ?? source?.kind ?? "video";
      const len = clipDuration(clip);
      if (url && kind !== "image") {
        const buffer = await decode(url);
        if (buffer) schedule(buffer, cursor, clip.start, len);
      }
      cursor += len;
    }
  }

  // Overlay audio: only unmuted, visible overlays contribute. Mirror the
  // preview, where an overlay <video> is muted by default (muted ?? true), so
  // an overlay whose flag was never set stays silent here too.
  for (const o of overlays) {
    const muted = o.muted ?? true;
    if (o.hidden || muted || o.kind !== "video") continue;
    const buffer = await decode(o.url);
    if (buffer) schedule(buffer, o.start, o.sourceStart, o.duration);
  }

  // Extra audio tracks, each from its own (possibly trimmed) in-point.
  for (const t of audioTracks) {
    if (t.muted) continue;
    const buffer = await decode(t.url);
    if (buffer) schedule(buffer, t.start, t.sourceStart, t.duration);
  }

  if (scheduled === 0) return null;
  return ctx.startRendering();
}
