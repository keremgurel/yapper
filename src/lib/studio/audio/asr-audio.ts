import { aacToAdts } from "@/lib/studio/audio/aac-adts";
import { decodeAudioChunks } from "@/lib/studio/audio/decode-track";
import { demuxAudioTrackCached } from "@/lib/studio/audio/demux-cache";
import { encodeWav } from "@/lib/studio/wav";

/** Audio payload ready to POST to the transcription backend. */
export interface AsrAudio {
  blob: Blob;
  /** Debug/telemetry label for how the payload was produced. */
  via: "aac" | "wav48" | "wav16";
  /** The payload's true length in seconds, sent so the backend can detect a
   * body truncated in transit (the ASR would hear less than this). */
  durationSec: number;
}

/** Average all channels into one, keeping the native sample rate (no resample). */
function downmixMono(channels: Float32Array[]): Float32Array {
  const n = channels[0]?.length ?? 0;
  const ch = channels.length;
  if (ch === 1) return channels[0] ?? new Float32Array(0);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let sum = 0;
    for (let c = 0; c < ch; c++) sum += channels[c][i] ?? 0;
    out[i] = sum / ch;
  }
  return out;
}

/**
 * Build the audio to transcribe from a media URL, prioritising ACCURACY. The
 * backend ASR merges closely-spaced retakes when the audio is downsampled to
 * 16 kHz in-browser, so we send the ORIGINAL audio instead:
 *
 *  1. AAC (the camera/recorder case): remux the demuxed frames to a `.aac`
 *     stream — original bytes, no decode, no resample. Most accurate + compact.
 *  2. Otherwise decode with WebCodecs and send a native-rate mono WAV (still no
 *     resample, just a downmix).
 *  3. Last resort, when neither mp4box nor WebCodecs can handle the container,
 *     the caller's 16 kHz path is used.
 *
 * Throws only if every native path fails; the caller then falls back to 16 kHz.
 */
export async function buildAsrAudio(url: string): Promise<AsrAudio> {
  const demuxed = await demuxAudioTrackCached(url);

  const adts = aacToAdts(demuxed);
  if (adts) {
    // Chunk durations are microseconds (see demux-audio.ts).
    const durationSec =
      demuxed.chunks.reduce((s, c) => s + c.duration, 0) / 1_000_000;
    return {
      blob: new Blob([adts as BlobPart], { type: "audio/aac" }),
      via: "aac",
      durationSec,
    };
  }

  // Non-AAC track that mp4box could still demux: decode and send native-rate
  // mono WAV so we never run the accuracy-killing 16 kHz resample.
  const { channels, sampleRate } = await decodeAudioChunks(demuxed);
  const mono = downmixMono(channels);
  return {
    blob: encodeWav(mono, sampleRate),
    via: "wav48",
    durationSec: sampleRate > 0 ? mono.length / sampleRate : 0,
  };
}
