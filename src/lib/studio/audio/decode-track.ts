import type { DemuxedAudio } from "@/lib/studio/audio/demux-audio";

/** Decoded PCM: one Float32Array per channel, all at `sampleRate`. */
export interface DecodedPcm {
  channels: Float32Array[];
  sampleRate: number;
}
// The general editor/export decoder preserves every source channel. Its cap is
// deliberately separate from the transcription path, which downmixes each
// decoded frame immediately and uses a substantially smaller mono cap.
export const MAX_DECODED_PCM_BYTES = 256 * 1024 * 1024;
export const MAX_TRANSCRIPTION_MONO_PCM_BYTES = 128 * 1024 * 1024;

export function estimatedDecodedPcmBytes(
  durationSeconds: number,
  sampleRate: number,
  numberOfChannels: number,
  downmixMono = false,
): number {
  if (
    !Number.isFinite(durationSeconds) ||
    !Number.isFinite(sampleRate) ||
    !Number.isFinite(numberOfChannels) ||
    durationSeconds < 0 ||
    sampleRate <= 0 ||
    numberOfChannels <= 0
  ) {
    return Number.POSITIVE_INFINITY;
  }
  return (
    durationSeconds *
    sampleRate *
    (downmixMono ? 1 : numberOfChannels) *
    Float32Array.BYTES_PER_ELEMENT
  );
}

/**
 * Decode demuxed AAC chunks to raw PCM with WebCodecs AudioDecoder. This is the
 * accurate, gapless counterpart to Web Audio's decodeAudioData: every encoded
 * frame is fed in order and every output sample is kept, so no speech is lost.
 */
export async function decodeAudioChunks(
  demuxed: DemuxedAudio,
  signal?: AbortSignal,
  options: { downmixMono?: boolean; maxBytes?: number } = {},
): Promise<DecodedPcm> {
  signal?.throwIfAborted();
  const maxBytes = options.maxBytes ?? MAX_DECODED_PCM_BYTES;
  const retainedChannels = options.downmixMono ? 1 : demuxed.numberOfChannels;
  const estimatedDuration = demuxed.chunks.reduce(
    (sum, chunk) => sum + chunk.duration / 1_000_000,
    0,
  );
  if (
    estimatedDecodedPcmBytes(
      estimatedDuration,
      demuxed.sampleRate,
      retainedChannels,
    ) > maxBytes
  ) {
    throw new Error("decoded_audio_too_large");
  }
  if (typeof AudioDecoder !== "function") {
    throw new Error("AudioDecoder unavailable");
  }

  const channelData: Float32Array[][] = [];
  let sampleRate = demuxed.sampleRate;
  let numberOfChannels = demuxed.numberOfChannels;
  let decodedBytes = 0;
  let decodeLimitExceeded = false;
  let decodeError: unknown;
  // Mono transcription has a known upper bound before decode starts. Write
  // every output frame directly into one retained buffer, avoiding the former
  // frame-list + concatenate peak (roughly two copies of the native-rate PCM).
  const maxMonoFrames = Math.floor(maxBytes / Float32Array.BYTES_PER_ELEMENT);
  const expectedMonoFrames = Math.ceil(estimatedDuration * demuxed.sampleRate);
  const monoData = options.downmixMono
    ? new Float32Array(
        Math.min(maxMonoFrames, expectedMonoFrames + demuxed.sampleRate),
      )
    : undefined;
  let monoOffset = 0;

  const decoder = new AudioDecoder({
    output: (data) => {
      sampleRate = data.sampleRate;
      const decodedChannelCount = data.numberOfChannels;
      numberOfChannels = options.downmixMono ? 1 : decodedChannelCount;
      const frameBytes =
        data.numberOfFrames * numberOfChannels * Float32Array.BYTES_PER_ELEMENT;
      if (decodedBytes + frameBytes > maxBytes) {
        decodeLimitExceeded = true;
        data.close();
        decoder.reset();
        return;
      }
      decodedBytes += frameBytes;
      const frame: Float32Array[] = [];
      if (options.downmixMono) {
        if (!monoData || monoOffset + data.numberOfFrames > monoData.length) {
          decodeLimitExceeded = true;
          data.close();
          decoder.reset();
          return;
        }
        for (let c = 0; c < decodedChannelCount; c++) {
          const plane = new Float32Array(data.numberOfFrames);
          data.copyTo(plane, { planeIndex: c, format: "f32-planar" });
          for (let index = 0; index < plane.length; index++) {
            monoData[monoOffset + index] += plane[index] / decodedChannelCount;
          }
        }
        monoOffset += data.numberOfFrames;
      } else {
        for (let c = 0; c < numberOfChannels; c++) {
          const out = new Float32Array(data.numberOfFrames);
          data.copyTo(out, { planeIndex: c, format: "f32-planar" });
          frame.push(out);
        }
      }
      if (!options.downmixMono) channelData.push(frame);
      data.close();
    },
    error: (e) => {
      // WebCodecs invokes this callback outside the awaited control flow.
      // Record the provider error and surface it deterministically through the
      // flush path instead of throwing an uncaught exception from a callback.
      decodeError = e;
    },
  });

  decoder.configure({
    codec: demuxed.codec,
    sampleRate: demuxed.sampleRate,
    numberOfChannels: demuxed.numberOfChannels,
    ...(demuxed.description ? { description: demuxed.description } : {}),
  });

  const onAbort = () => {
    try {
      decoder.reset();
    } catch {
      // A concurrent provider/decoder failure may already have closed it.
    }
  };
  signal?.addEventListener("abort", onAbort, { once: true });
  try {
    for (const chunk of demuxed.chunks) {
      signal?.throwIfAborted();
      decoder.decode(
        new EncodedAudioChunk({
          type: "key", // every AAC frame is independently decodable
          timestamp: chunk.timestamp,
          duration: chunk.duration,
          data: chunk.data,
        }),
      );
    }
    signal?.throwIfAborted();
    try {
      await decoder.flush();
    } catch (error) {
      if (decodeLimitExceeded) throw new Error("decoded_audio_too_large");
      if (decodeError !== undefined) throw decodeError;
      throw error;
    }
    if (decodeLimitExceeded) throw new Error("decoded_audio_too_large");
    if (decodeError !== undefined) throw decodeError;
    signal?.throwIfAborted();
  } finally {
    signal?.removeEventListener("abort", onAbort);
    if (decoder.state !== "closed") decoder.close();
  }

  if (monoData) {
    return { channels: [monoData.subarray(0, monoOffset)], sampleRate };
  }

  // Concatenate per-channel frames into one contiguous buffer per channel.
  const total = channelData.reduce((n, f) => n + (f[0]?.length ?? 0), 0);
  const channels: Float32Array[] = Array.from(
    { length: numberOfChannels },
    () => new Float32Array(total),
  );
  let offset = 0;
  for (const frame of channelData) {
    const len = frame[0]?.length ?? 0;
    for (let c = 0; c < numberOfChannels; c++) {
      if (frame[c]) channels[c].set(frame[c], offset);
    }
    offset += len;
  }

  return { channels, sampleRate };
}
