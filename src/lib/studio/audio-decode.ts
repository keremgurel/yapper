import { extractPcm } from "@/lib/studio/audio/extract-pcm";

// Decoding a full recording to 16 kHz is expensive, and transcribe / trim /
// 1-Click each need it. Cache the last couple of decodes by URL so the common
// "transcribe then edit" sequence pays for it once.
const CACHE_LIMIT = 2;
const cache = new Map<string, Promise<Float32Array>>();

/** Decode a media URL to mono Float32 PCM at 16 kHz (what the ASR expects).
 * Runs in the browser (no upload) and caches recent results. */
export function decodeToMono16k(url: string): Promise<Float32Array> {
  const cached = cache.get(url);
  if (cached) return cached;
  const pending = decodeFresh(url).catch((e) => {
    cache.delete(url); // don't cache a failure — allow a retry
    throw e;
  });
  cache.set(url, pending);
  while (cache.size > CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
  return pending;
}

/** Drop a URL's cached PCM (call when its blob is revoked / source replaced). */
export function forgetDecodedAudio(url: string): void {
  cache.delete(url);
}

const TARGET_RATE = 16000;

async function decodeFresh(url: string): Promise<Float32Array> {
  // Preferred path: mp4box demux + WebCodecs decode, which is gapless. Web
  // Audio's decodeAudioData drops chunks of audio on multi-track camera files
  // (dropping whole retakes from the transcript), so it's only the fallback for
  // formats WebCodecs can't handle.
  try {
    const { channels, sampleRate } = await extractPcm(url);
    const secs = (channels[0]?.length ?? 0) / sampleRate;
    console.info(
      `[audio] decoded via WebCodecs: ${secs.toFixed(1)}s @ ${sampleRate}Hz, ${channels.length}ch`,
    );
    return toMono16k(channels, sampleRate);
  } catch (e) {
    console.warn(
      "[audio] WebCodecs decode failed, falling back to Web Audio (may drop audio on multi-track files)",
      e,
    );
    return decodeViaWebAudio(url);
  }
}

/** Downmix to mono and resample to 16 kHz via an OfflineAudioContext. */
async function toMono16k(
  channels: Float32Array[],
  sampleRate: number,
): Promise<Float32Array> {
  const length = channels[0]?.length ?? 0;
  if (length === 0) return new Float32Array(0);
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext })
      .webkitAudioContext;
  const tmp = new AudioCtx();
  const src = tmp.createBuffer(channels.length, length, sampleRate);
  for (let c = 0; c < channels.length; c++) {
    // Copy into a fresh ArrayBuffer-backed view (satisfies copyToChannel's type
    // and guards against a SharedArrayBuffer-backed source).
    src.copyToChannel(new Float32Array(channels[c]), c);
  }
  void tmp.close();

  const frames = Math.max(1, Math.ceil((length / sampleRate) * TARGET_RATE));
  const offline = new OfflineAudioContext(1, frames, TARGET_RATE);
  const node = offline.createBufferSource();
  node.buffer = src;
  node.connect(offline.destination);
  node.start();
  const rendered = await offline.startRendering();
  return rendered.getChannelData(0).slice();
}

/** Legacy fallback: Web Audio decode (used only when WebCodecs can't decode). */
async function decodeViaWebAudio(url: string): Promise<Float32Array> {
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
  const channels = Array.from({ length: decoded.numberOfChannels }, (_, c) =>
    decoded.getChannelData(c),
  );
  return toMono16k(channels, decoded.sampleRate);
}
