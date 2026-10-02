import { MAX_ASSESSED_SECONDS } from "./types";

const SAMPLE_RATE = 16_000;

type AudioContextCtor = typeof AudioContext;

/** Wrap 16-bit mono samples in a WAV header. */
function encodeWav(samples: Float32Array): ArrayBuffer {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const ascii = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i += 1)
      view.setUint8(offset + i, text.charCodeAt(i));
  };
  ascii(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  ascii(8, "WAVEfmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, SAMPLE_RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  ascii(36, "data");
  view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i += 1) {
    const sample = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(
      44 + i * 2,
      sample < 0 ? sample * 0x8000 : sample * 0x7fff,
      true,
    );
  }
  return buffer;
}

/**
 * Decode a recording in the browser and return its opening stretch as 16 kHz
 * mono WAV, which is the one format the Speech service takes without a media
 * pipeline. Browser only.
 */
export async function recordingToWav(recording: Blob): Promise<File> {
  const Context: AudioContextCtor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext: AudioContextCtor })
      .webkitAudioContext;
  const context = new Context();
  let decoded: AudioBuffer;
  try {
    decoded = await context.decodeAudioData(await recording.arrayBuffer());
  } finally {
    void context.close();
  }
  const seconds = Math.min(decoded.duration, MAX_ASSESSED_SECONDS);
  const offline = new OfflineAudioContext(
    1,
    Math.max(1, Math.ceil(seconds * SAMPLE_RATE)),
    SAMPLE_RATE,
  );
  const source = offline.createBufferSource();
  source.buffer = decoded;
  source.connect(offline.destination);
  source.start();
  const rendered = await offline.startRendering();
  return new File([encodeWav(rendered.getChannelData(0))], "rep.wav", {
    type: "audio/wav",
  });
}
