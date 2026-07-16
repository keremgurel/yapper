import { projectDuration } from "@/lib/studio/project-duration";
import { extractPcm } from "@/lib/studio/audio/extract-pcm";
import { planAudioMix } from "@/lib/studio/export/audio-plan";
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
  const { clips, overlays, audioTracks } = input;
  const duration = projectDuration(clips, overlays, audioTracks);
  if (duration <= 0) return null;

  // What plays, where, and for how long is decided purely (and under test) in
  // planAudioMix; this function only decodes and renders it.
  const placements = planAudioMix(input, duration);
  if (placements.length === 0) return null;

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

  // A planned slice that fails to decode (a valid file with no audio track)
  // contributes nothing, so an all-undecodable plan still renders to silence.
  let scheduled = 0;
  for (const p of placements) {
    const buffer = await decode(p.url);
    if (!buffer) continue;
    const node = ctx.createBufferSource();
    node.buffer = buffer;
    node.connect(ctx.destination);
    node.start(
      p.when,
      Math.max(0, p.offset),
      Math.min(p.length, duration - p.when),
    );
    scheduled += 1;
  }

  if (scheduled === 0) return null;
  return ctx.startRendering();
}
