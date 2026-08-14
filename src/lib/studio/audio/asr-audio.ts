import { aacToAdts } from "@/lib/studio/audio/aac-adts";
import { decodeAudioChunks } from "@/lib/studio/audio/decode-track";
import { demuxAudioTrackCached } from "@/lib/studio/audio/demux-cache";
import { downmixMono } from "@/lib/studio/audio/downmix";
import { encodeWav } from "@/lib/studio/wav";

/** Audio payload ready to POST to the transcription backend. */
export interface AsrAudio {
  blob: Blob;
  /** Debug/telemetry label for how the payload was produced. */
  via: "aac" | "wav48" | "wav16";
  /** The payload's true length in seconds, sent so the backend can detect a
   * body truncated in transit (the ASR would hear less than this). */
  durationSec: number;
  /** Where this chunk begins in the original source. */
  offsetSec: number;
}

// Vercel rejects function request bodies above 4.5 MB before the route runs.
// Keep enough headroom for headers/proxy accounting rather than aiming at the
// published ceiling exactly.
export const MAX_ASR_CHUNK_BYTES = 3_500_000;
export const ASR_CHUNK_OVERLAP_SEC = 5;
const MAX_ASR_CHUNK_DURATION_SEC = 590;

interface ByteSizedChunk {
  data: Uint8Array;
  durationSec: number;
  offsetSec: number;
}

export interface PcmChunkRange {
  start: number;
  end: number;
}

/**
 * Plan PCM windows without allocating their audio. Keeping this arithmetic
 * separate makes long-recording coverage testable without creating a
 * 15-minute Float32Array in the test runner.
 */
export function planPcmChunks(
  sampleCount: number,
  sampleRate: number,
  maxBytes: number,
  overlapSec: number,
): PcmChunkRange[] {
  if (
    !Number.isSafeInteger(sampleCount) ||
    sampleCount < 0 ||
    !Number.isFinite(sampleRate) ||
    sampleRate <= 0 ||
    !Number.isFinite(maxBytes) ||
    maxBytes <= 44
  ) {
    throw new Error("invalid PCM chunk parameters");
  }
  if (sampleCount === 0) return [];

  const maxSamples = Math.max(1, Math.floor((maxBytes - 44) / 2));
  const requestedOverlap = Math.max(0, overlapSec) * sampleRate;
  const overlapSamples = Math.min(
    Math.floor(requestedOverlap),
    Math.max(0, maxSamples - 1),
  );
  const chunks: PcmChunkRange[] = [];
  let start = 0;
  while (start < sampleCount) {
    const end = Math.min(sampleCount, start + maxSamples);
    chunks.push({ start, end });
    if (end >= sampleCount) break;
    start = end - overlapSamples;
  }
  return chunks;
}

/** Split encoded AAC only on real frame boundaries, with context overlap. */
function chunkAac(
  demuxed: Awaited<ReturnType<typeof demuxAudioTrackCached>>,
  maxBytes: number,
  overlapSec: number,
): ByteSizedChunk[] | null {
  // A one-frame probe performs all codec/sample-rate/channel guards without
  // allocating the full recording.
  if (!aacToAdts(demuxed, demuxed.chunks.slice(0, 1))) return null;

  const starts: number[] = [];
  let elapsed = 0;
  for (const chunk of demuxed.chunks) {
    starts.push(elapsed);
    elapsed += chunk.duration / 1_000_000;
  }

  const result: ByteSizedChunk[] = [];
  let start = 0;
  while (start < demuxed.chunks.length) {
    let end = start;
    let bytes = 0;
    while (end < demuxed.chunks.length) {
      const frameBytes = 7 + demuxed.chunks[end].data.length;
      const nextDuration =
        starts[end] - starts[start] + demuxed.chunks[end].duration / 1_000_000;
      if (
        end > start &&
        (bytes + frameBytes > maxBytes ||
          nextDuration > MAX_ASR_CHUNK_DURATION_SEC)
      ) {
        break;
      }
      bytes += frameBytes;
      end++;
    }

    const selected = demuxed.chunks.slice(start, end);
    const durationSec = selected.reduce(
      (sum, chunk) => sum + chunk.duration / 1_000_000,
      0,
    );
    result.push({
      get data() {
        const data = aacToAdts(demuxed, selected);
        if (!data) throw new Error("AAC chunk encoding failed");
        return data;
      },
      durationSec,
      offsetSec: starts[start] ?? 0,
    });
    if (end >= demuxed.chunks.length) break;

    // Walk back from the next new frame until the requested overlap is met.
    // Always advance by at least one frame, even with an unusually tiny cap.
    let next = end;
    const overlapFloor = Math.max(
      starts[start] + 0.001,
      starts[end] - overlapSec,
    );
    while (next > start + 1 && starts[next - 1] >= overlapFloor) next--;
    start = next;
  }
  return result;
}

function chunkPcm(
  samples: Float32Array,
  sampleRate: number,
  maxBytes: number,
  overlapSec: number,
): AsrAudio[] {
  return planPcmChunks(samples.length, sampleRate, maxBytes, overlapSec).map(
    ({ start, end }) => {
      const planned = {
        via: (sampleRate <= 16000 ? "wav16" : "wav48") as "wav16" | "wav48",
        durationSec: (end - start) / sampleRate,
        offsetSec: start / sampleRate,
      };
      return {
        ...planned,
        // A getter keeps every WAV allocation behind the two-worker admission
        // gate in transcribeAsrChunks. Planning a long take is metadata-only.
        get blob() {
          return encodeWav(samples.subarray(start, end), sampleRate);
        },
      };
    },
  );
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
  const [audio] = await buildAsrAudioChunks(url, Number.MAX_SAFE_INTEGER, 0);
  if (!audio) throw new Error("no audio track");
  return audio;
}

/**
 * Build upload-safe, overlapping native-audio chunks. Every Blob is a complete
 * AAC or WAV file, so each request remains independently decodable by the ASR.
 */
export async function buildAsrAudioChunks(
  url: string,
  maxBytes = MAX_ASR_CHUNK_BYTES,
  overlapSec = ASR_CHUNK_OVERLAP_SEC,
  signal?: AbortSignal,
): Promise<AsrAudio[]> {
  signal?.throwIfAborted();
  const demuxed = await demuxAudioTrackCached(url, signal);
  signal?.throwIfAborted();

  return buildAsrAudioChunksFromDemux(demuxed, maxBytes, overlapSec, signal);
}

export async function buildAsrAudioChunksFromDemux(
  demuxed: Awaited<ReturnType<typeof demuxAudioTrackCached>>,
  maxBytes = MAX_ASR_CHUNK_BYTES,
  overlapSec = ASR_CHUNK_OVERLAP_SEC,
  signal?: AbortSignal,
): Promise<AsrAudio[]> {
  signal?.throwIfAborted();

  const aac = buildAacAsrChunksFromDemux(demuxed, maxBytes, overlapSec);
  if (aac) return aac;

  // Non-AAC track that mp4box could still demux: decode and send native-rate
  // mono WAV so we never run the accuracy-killing 16 kHz resample.
  const { channels, sampleRate } = await decodeAudioChunks(demuxed, signal);
  const mono = downmixMono(channels);
  return chunkPcm(mono, sampleRate, maxBytes, overlapSec);
}

export function buildAacAsrChunksFromDemux(
  demuxed: Awaited<ReturnType<typeof demuxAudioTrackCached>>,
  maxBytes = MAX_ASR_CHUNK_BYTES,
  overlapSec = ASR_CHUNK_OVERLAP_SEC,
): AsrAudio[] | null {
  const aac = chunkAac(demuxed, maxBytes, overlapSec);
  if (!aac) return null;
  return aac.map((chunk) => ({
    get blob() {
      return new Blob([chunk.data as BlobPart], { type: "audio/aac" });
    },
    via: "aac" as const,
    durationSec: chunk.durationSec,
    offsetSec: chunk.offsetSec,
  }));
}

/** Build upload-safe chunks for the 16 kHz last-resort decode path. */
export function chunkMono16k(
  samples: Float32Array,
  maxBytes = MAX_ASR_CHUNK_BYTES,
  overlapSec = ASR_CHUNK_OVERLAP_SEC,
): AsrAudio[] {
  return chunkPcm(samples, 16000, maxBytes, overlapSec);
}

/** Build upload-safe chunks from an already-decoded native-rate mono track. */
export function chunkMonoPcm(
  samples: Float32Array,
  sampleRate: number,
  maxBytes = MAX_ASR_CHUNK_BYTES,
  overlapSec = ASR_CHUNK_OVERLAP_SEC,
): AsrAudio[] {
  return chunkPcm(samples, sampleRate, maxBytes, overlapSec);
}
