/** Decode a media URL to mono Float32 PCM at 16 kHz (what Whisper expects).
 * Runs in the browser via Web Audio — no upload. */
export async function decodeToMono16k(url: string): Promise<Float32Array> {
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext })
      .webkitAudioContext;

  const arrayBuffer = await (await fetch(url)).arrayBuffer();
  const tmp = new AudioCtx();
  let decoded: AudioBuffer;
  try {
    decoded = await tmp.decodeAudioData(arrayBuffer);
  } finally {
    void tmp.close();
  }

  const targetRate = 16000;
  const frames = Math.max(1, Math.ceil(decoded.duration * targetRate));
  const offline = new OfflineAudioContext(1, frames, targetRate);
  const src = offline.createBufferSource();
  src.buffer = decoded;
  src.connect(offline.destination);
  src.start();
  const rendered = await offline.startRendering();
  return rendered.getChannelData(0).slice();
}
