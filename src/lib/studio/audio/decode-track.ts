import type { DemuxedAudio } from "@/lib/studio/audio/demux-audio";

/** Decoded PCM: one Float32Array per channel, all at `sampleRate`. */
export interface DecodedPcm {
  channels: Float32Array[];
  sampleRate: number;
}

/**
 * Decode demuxed AAC chunks to raw PCM with WebCodecs AudioDecoder. This is the
 * accurate, gapless counterpart to Web Audio's decodeAudioData: every encoded
 * frame is fed in order and every output sample is kept, so no speech is lost.
 */
export async function decodeAudioChunks(
  demuxed: DemuxedAudio,
): Promise<DecodedPcm> {
  if (typeof AudioDecoder !== "function") {
    throw new Error("AudioDecoder unavailable");
  }

  const channelData: Float32Array[][] = [];
  let sampleRate = demuxed.sampleRate;
  let numberOfChannels = demuxed.numberOfChannels;

  const decoder = new AudioDecoder({
    output: (data) => {
      sampleRate = data.sampleRate;
      numberOfChannels = data.numberOfChannels;
      const frame: Float32Array[] = [];
      for (let c = 0; c < numberOfChannels; c++) {
        const out = new Float32Array(data.numberOfFrames);
        data.copyTo(out, { planeIndex: c, format: "f32-planar" });
        frame.push(out);
      }
      channelData.push(frame);
      data.close();
    },
    error: (e) => {
      throw e;
    },
  });

  decoder.configure({
    codec: demuxed.codec,
    sampleRate: demuxed.sampleRate,
    numberOfChannels: demuxed.numberOfChannels,
    ...(demuxed.description ? { description: demuxed.description } : {}),
  });

  for (const chunk of demuxed.chunks) {
    decoder.decode(
      new EncodedAudioChunk({
        type: "key", // every AAC frame is independently decodable
        timestamp: chunk.timestamp,
        duration: chunk.duration,
        data: chunk.data,
      }),
    );
  }
  await decoder.flush();
  decoder.close();

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
