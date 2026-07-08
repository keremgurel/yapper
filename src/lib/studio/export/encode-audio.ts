const AUDIO_BITRATE = 192_000;
const AAC_CODEC = "mp4a.40.2";

export interface AudioTrackConfig {
  sampleRate: number;
  numberOfChannels: number;
}

/** Config the muxer needs to declare the AAC audio track up front. */
export function audioTrackConfig(buffer: AudioBuffer): AudioTrackConfig {
  return {
    sampleRate: buffer.sampleRate,
    numberOfChannels: Math.min(2, buffer.numberOfChannels),
  };
}

type OnAudioChunk = (
  chunk: EncodedAudioChunk,
  meta: EncodedAudioChunkMetadata | undefined,
) => void;

/** Encode a rendered AudioBuffer to AAC, streaming chunks to `onChunk`. */
export async function encodeAudioBuffer(
  buffer: AudioBuffer,
  onChunk: OnAudioChunk,
): Promise<void> {
  const { sampleRate } = buffer;
  const channels = Math.min(2, buffer.numberOfChannels);
  const total = buffer.length;

  let encodeError: Error | null = null;
  const encoder = new AudioEncoder({
    output: onChunk,
    error: (e) => {
      encodeError = e instanceof Error ? e : new Error(String(e));
    },
  });
  encoder.configure({
    codec: AAC_CODEC,
    sampleRate,
    numberOfChannels: channels,
    bitrate: AUDIO_BITRATE,
  });

  const CHUNK = sampleRate; // ~1 second of audio per AudioData
  const channelData = Array.from({ length: channels }, (_, ch) =>
    buffer.getChannelData(ch),
  );

  for (let start = 0; start < total; start += CHUNK) {
    if (encodeError) throw encodeError;
    const frames = Math.min(CHUNK, total - start);
    // Planar f32: all of channel 0, then all of channel 1.
    const planar = new Float32Array(frames * channels);
    for (let ch = 0; ch < channels; ch++) {
      planar.set(channelData[ch].subarray(start, start + frames), ch * frames);
    }
    const audioData = new AudioData({
      format: "f32-planar",
      sampleRate,
      numberOfFrames: frames,
      numberOfChannels: channels,
      timestamp: Math.round((start / sampleRate) * 1_000_000),
      data: planar,
    });
    encoder.encode(audioData);
    audioData.close();
  }

  await encoder.flush();
  encoder.close();
  if (encodeError) throw encodeError;
}
