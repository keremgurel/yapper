import { extractPcm } from "@/lib/studio/audio/extract-pcm";
import { isNative } from "@/lib/studio/native/bridge";
import { nativePcm16k } from "@/lib/studio/native/media";
import { nativeMediaForUrl } from "@/lib/studio/native/path-registry";
import {
  buildAacAsrChunksFromDemux,
  chunkMonoPcm,
  chunkMono16k,
  type AsrAudio,
} from "@/lib/studio/audio/asr-audio";
import { demuxAudioTrack } from "@/lib/studio/audio/demux-audio";
import {
  decodeAudioChunks,
  MAX_TRANSCRIPTION_MONO_PCM_BYTES,
} from "@/lib/studio/audio/decode-track";

// Decoding a full recording to 16 kHz is expensive, and transcribe / trim /
// 1-Click each need it. Cache the last couple of decodes by URL so the common
// "transcribe then edit" sequence pays for it once.
const CACHE_BYTE_BUDGET = 64 * 1024 * 1024;
const cache = new Map<
  string,
  { promise: Promise<Float32Array>; controller: AbortController; bytes: number }
>();

function trimCache(): void {
  let bytes = [...cache.values()].reduce((sum, entry) => sum + entry.bytes, 0);
  while (bytes > CACHE_BYTE_BUDGET && cache.size > 0) {
    const oldest = cache.keys().next().value as string | undefined;
    if (!oldest) break;
    const entry = cache.get(oldest);
    entry?.controller.abort("decode_evicted");
    bytes -= entry?.bytes ?? 0;
    cache.delete(oldest);
  }
}

/** Decode a media URL to mono Float32 PCM at 16 kHz (what the ASR expects).
 * Runs in the browser (no upload) and caches recent results. */
export function decodeToMono16k(
  url: string,
  signal?: AbortSignal,
): Promise<Float32Array> {
  if (signal) return decodeFresh(url, signal);
  const cached = cache.get(url);
  if (cached) return cached.promise;
  const controller = new AbortController();
  const entry: typeof cache extends Map<string, infer Entry> ? Entry : never = {
    controller,
    bytes: 0,
    promise: Promise.resolve(new Float32Array()),
  };
  const pending = decodeFresh(url, controller.signal)
    .then((pcm) => {
      entry.bytes = pcm.byteLength;
      trimCache();
      return pcm;
    })
    .catch((e) => {
      cache.delete(url); // don't cache a failure — allow a retry
      throw e;
    });
  entry.promise = pending;
  cache.set(url, entry);
  return pending;
}

/** Drop a URL's cached PCM (call when its blob is revoked / source replaced). */
export function forgetDecodedAudio(url: string): void {
  cache.get(url)?.controller.abort("source_forgotten");
  cache.delete(url);
}

const TARGET_RATE = 16000;
const MAX_COMPAT_DURATION_SECONDS = 600;

export interface PreparedTranscriptionSource {
  mono16k: Float32Array;
  chunks: AsrAudio[];
}

export function optionalAsrChunks(
  includeAsrChunks: boolean,
  build: () => AsrAudio[],
): AsrAudio[] {
  return includeAsrChunks ? build() : [];
}

export class AudioPreparationAdmission {
  private active = false;
  private waiters: {
    start: (release: () => void) => void;
    signal?: AbortSignal;
  }[] = [];

  private release = (): void => {
    while (this.waiters.length > 0) {
      const waiter = this.waiters.shift()!;
      if (!waiter.signal?.aborted) {
        // Ownership transfers synchronously. `active` intentionally remains
        // true so a new arrival cannot enter before this waiter resumes.
        waiter.start(this.release);
        return;
      }
    }
    this.active = false;
  };

  private async acquire(signal?: AbortSignal): Promise<() => void> {
    signal?.throwIfAborted();
    if (!this.active) {
      this.active = true;
      return this.release;
    }
    return new Promise<() => void>((resolve, reject) => {
      const waiter = { start: resolve, signal };
      const onAbort = () => {
        this.waiters = this.waiters.filter((candidate) => candidate !== waiter);
        reject(signal?.reason ?? new DOMException("Aborted", "AbortError"));
      };
      waiter.start = (release) => {
        signal?.removeEventListener("abort", onAbort);
        resolve(release);
      };
      signal?.addEventListener("abort", onAbort, { once: true });
      this.waiters.push(waiter);
    });
  }

  async run<T>(work: () => Promise<T>, signal?: AbortSignal): Promise<T> {
    const release = await this.acquire(signal);
    try {
      signal?.throwIfAborted();
      return await work();
    } finally {
      release();
    }
  }
}

const transcriptionAdmission = new AudioPreparationAdmission();

/** One source preparation feeds both accurate ASR payloads and local VAD. */
export async function prepareTranscriptionSource(
  url: string,
  signal: AbortSignal,
  options: { includeAsrChunks?: boolean } = {},
): Promise<PreparedTranscriptionSource> {
  return transcriptionAdmission.run(
    () =>
      prepareTranscriptionSourceAdmitted(
        url,
        signal,
        options.includeAsrChunks ?? true,
      ),
    signal,
  );
}

async function prepareTranscriptionSourceAdmitted(
  url: string,
  signal: AbortSignal,
  includeAsrChunks: boolean,
): Promise<PreparedTranscriptionSource> {
  signal.throwIfAborted();
  if (isNative()) {
    const native = nativeMediaForUrl(url);
    if (native) {
      const mono16k = await nativePcm16k(native.path, signal);
      return {
        mono16k,
        chunks: optionalAsrChunks(includeAsrChunks, () =>
          chunkMono16k(mono16k, 1_000_000, 5),
        ),
      };
    }
  }
  try {
    const demuxed = await demuxAudioTrack(url, signal);
    // Transcription only needs mono PCM for VAD/non-AAC WAV chunks. Downmix
    // each WebCodecs frame before retaining it: a 10-minute 48 kHz recording
    // retains ~115 MiB rather than ~230 MiB stereo, then resamples to ~38 MiB.
    const { channels, sampleRate } = await decodeAudioChunks(demuxed, signal, {
      downmixMono: true,
      maxBytes: MAX_TRANSCRIPTION_MONO_PCM_BYTES,
    });
    const nativeMono = channels[0];
    const chunks = optionalAsrChunks(
      includeAsrChunks,
      () =>
        buildAacAsrChunksFromDemux(demuxed) ??
        chunkMonoPcm(nativeMono, sampleRate),
    );
    const mono16k = await toMono16k([nativeMono], sampleRate, signal);
    return { mono16k, chunks };
  } catch (error) {
    signal.throwIfAborted();
    if (
      error instanceof Error &&
      (error.message === "media_too_large_for_browser_transcription" ||
        error.message === "decoded_audio_too_large")
    ) {
      throw error;
    }
    const mono16k = await decodeStreamingCompatibilityAudio(url, signal, error);
    return {
      mono16k,
      chunks: optionalAsrChunks(includeAsrChunks, () => chunkMono16k(mono16k)),
    };
  }
}

/**
 * Decode one native-rate mono source under the same single-preparation lease
 * used by transcription. Recaption needs source-rate samples for precise clip
 * boundaries but never needs to retain stereo PCM or construct ASR payloads.
 */
export async function extractAdmittedMonoPcm(
  url: string,
  signal?: AbortSignal,
): Promise<{ samples: Float32Array; sampleRate: number }> {
  const effectiveSignal = signal ?? new AbortController().signal;
  return transcriptionAdmission.run(async () => {
    effectiveSignal.throwIfAborted();
    if (isNative()) {
      const native = nativeMediaForUrl(url);
      if (native) {
        return {
          samples: await nativePcm16k(native.path, effectiveSignal),
          sampleRate: TARGET_RATE,
        };
      }
    }
    try {
      const demuxed = await demuxAudioTrack(url, effectiveSignal);
      const decoded = await decodeAudioChunks(demuxed, effectiveSignal, {
        downmixMono: true,
        maxBytes: MAX_TRANSCRIPTION_MONO_PCM_BYTES,
      });
      return { samples: decoded.channels[0], sampleRate: decoded.sampleRate };
    } catch (error) {
      effectiveSignal.throwIfAborted();
      if (
        error instanceof Error &&
        (error.message === "media_too_large_for_browser_transcription" ||
          error.message === "decoded_audio_too_large")
      ) {
        throw error;
      }
      return {
        samples: await decodeStreamingCompatibilityAudio(
          url,
          effectiveSignal,
          error,
        ),
        sampleRate: TARGET_RATE,
      };
    }
  }, effectiveSignal);
}

async function decodeFresh(
  url: string,
  signal: AbortSignal,
): Promise<Float32Array> {
  signal.throwIfAborted();
  // Desktop: decode the clean ffmpeg-extracted audio, fetched over IPC. This
  // sidesteps both the cross-origin fetch of an asset:// URL and the multi-track
  // WebCodecs path that drops retakes on some camera files.
  if (isNative()) {
    const native = nativeMediaForUrl(url);
    if (native) {
      try {
        // Playback may use a low-resolution companion/proxy, but analysis and
        // transcription must always decode the original audio track. A proxy
        // is allowed to lower audio quality or omit tracks, which would make
        // words disappear before ASR ever receives them.
        return await nativePcm16k(native.path, signal);
      } catch (e) {
        const detail = e instanceof Error ? e.message : String(e);
        throw new Error(`Desktop audio preparation failed: ${detail}`, {
          cause: e,
        });
      }
    }
  }

  // Preferred path: mp4box demux + WebCodecs decode, which is gapless. Web
  // Audio's decodeAudioData drops chunks of audio on multi-track camera files
  // (dropping whole retakes from the transcript), so it's only the fallback for
  // formats WebCodecs can't handle.
  try {
    const { channels, sampleRate } = await extractPcm(url, signal);
    const secs = (channels[0]?.length ?? 0) / sampleRate;
    console.info(
      `[audio] decoded via WebCodecs: ${secs.toFixed(1)}s @ ${sampleRate}Hz, ${channels.length}ch`,
    );
    return toMono16k(channels, sampleRate, signal);
  } catch (e) {
    signal.throwIfAborted();
    if (
      e instanceof Error &&
      (e.message === "media_too_large_for_browser_transcription" ||
        e.message === "decoded_audio_too_large")
    ) {
      throw e;
    }
    // MediaRecorder WebM/Opus is not readable by mp4box. Preserve that common
    // browser format under a deliberately small input + duration envelope so
    // decodeAudioData cannot expand an attacker-controlled long recording into
    // multi-gigabyte PCM before JavaScript regains control.
    return decodeStreamingCompatibilityAudio(url, signal, e);
  }
}

type MediabunnyModule = typeof import("mediabunny");

export async function decodeStreamingCompatibilityAudio(
  url: string,
  signal: AbortSignal,
  cause: unknown,
  options: {
    loadMediabunny?: () => Promise<MediabunnyModule>;
    targetRate?: number;
    maxDurationSeconds?: number;
  } = {},
): Promise<Float32Array> {
  const loadMediabunny = options.loadMediabunny ?? (() => import("mediabunny"));
  const { Input, UrlSource, AudioSampleSink, WEBM, MATROSKA, OGG } =
    await loadMediabunny();
  // AbortSignal events are not replayed. Cancellation during the first lazy
  // module load must stop before constructing a source that could begin I/O.
  signal.throwIfAborted();
  const targetRate = options.targetRate ?? TARGET_RATE;
  const maxDurationSeconds =
    options.maxDurationSeconds ?? MAX_COMPAT_DURATION_SECONDS;
  const input = new Input({
    formats: [WEBM, MATROSKA, OGG],
    source: new UrlSource(url, {
      maxCacheSize: 8 * 1024 * 1024,
      parallelism: 1,
      getRetryDelay: () => null,
    }),
  });
  const onAbort = () => input.dispose();
  signal.addEventListener("abort", onAbort, { once: true });
  try {
    const track = await input.getPrimaryAudioTrack();
    if (!track || !(await track.canDecode())) {
      throw new Error("browser_audio_decode_unsupported", { cause });
    }
    const duration = await track.computeDuration();
    if (
      !Number.isFinite(duration) ||
      duration <= 0 ||
      duration > maxDurationSeconds
    ) {
      throw new Error("browser_audio_decode_unsupported", { cause });
    }
    const output = new Float32Array(Math.ceil(duration * targetRate));
    const sink = new AudioSampleSink(track);
    for await (const sample of sink.samples()) {
      try {
        signal.throwIfAborted();
        const mono = new Float32Array(sample.numberOfFrames);
        for (let channel = 0; channel < sample.numberOfChannels; channel++) {
          const plane = new Float32Array(sample.numberOfFrames);
          sample.copyTo(plane, { format: "f32-planar", planeIndex: channel });
          for (let frame = 0; frame < plane.length; frame++) {
            mono[frame] += plane[frame] / sample.numberOfChannels;
          }
        }
        const outputStart = Math.max(
          0,
          Math.round(sample.timestamp * targetRate),
        );
        const outputCount = Math.round(sample.duration * targetRate);
        for (
          let frame = 0;
          frame < outputCount && outputStart + frame < output.length;
          frame++
        ) {
          const sourceIndex = Math.min(
            mono.length - 1,
            Math.floor((frame / Math.max(1, outputCount)) * mono.length),
          );
          output[outputStart + frame] = mono[sourceIndex] ?? 0;
        }
      } finally {
        sample.close();
      }
    }
    signal.throwIfAborted();
    return output;
  } finally {
    signal.removeEventListener("abort", onAbort);
    input.dispose();
  }
}

/** Downmix to mono and resample to 16 kHz via an OfflineAudioContext. */
async function toMono16k(
  channels: Float32Array[],
  sampleRate: number,
  signal?: AbortSignal,
): Promise<Float32Array> {
  signal?.throwIfAborted();
  const length = channels[0]?.length ?? 0;
  if (length === 0) return new Float32Array(0);
  if (signal) return downmixResampleCancellable(channels, sampleRate, signal);
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

async function downmixResampleCancellable(
  channels: Float32Array[],
  sampleRate: number,
  signal: AbortSignal,
): Promise<Float32Array> {
  const sourceLength = channels[0]?.length ?? 0;
  const output = new Float32Array(
    Math.max(1, Math.ceil((sourceLength / sampleRate) * TARGET_RATE)),
  );
  const framesPerYield = 32_768;
  for (let outputIndex = 0; outputIndex < output.length; outputIndex++) {
    if (outputIndex % framesPerYield === 0) {
      signal.throwIfAborted();
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
    const sourcePosition = (outputIndex * sampleRate) / TARGET_RATE;
    const left = Math.min(sourceLength - 1, Math.floor(sourcePosition));
    const right = Math.min(sourceLength - 1, left + 1);
    const fraction = sourcePosition - left;
    let mixed = 0;
    for (const channel of channels) {
      mixed +=
        ((channel[left] ?? 0) * (1 - fraction) +
          (channel[right] ?? 0) * fraction) /
        channels.length;
    }
    output[outputIndex] = mixed;
  }
  signal.throwIfAborted();
  return output;
}
