/**
 * Native ffmpeg media ops, one thin wrapper per Rust command. These run only in
 * the desktop app; callers gate on `isNative()` and fall back to the browser
 * pipeline otherwise.
 */

import { assetUrl, invoke } from "@/lib/studio/native/bridge";
import { waveformFromBytes, type Filmstrip } from "@/lib/studio/filmstrip";

interface FfprobeStream {
  codec_type?: string;
  width?: number;
  height?: number;
}
interface Ffprobe {
  format?: { duration?: string };
  streams?: FfprobeStream[];
}

export interface NativeProbe {
  duration: number;
  width?: number;
  height?: number;
  aspect: number;
}

/** ffprobe the file for the few facts `loadVideoSource` reads off a <video>. */
export async function nativeProbe(path: string): Promise<NativeProbe> {
  const data = await invoke<Ffprobe>("probe_media", { path });
  const video = data.streams?.find((s) => s.codec_type === "video");
  const width = video?.width;
  const height = video?.height;
  const duration = Number(data.format?.duration) || 0;
  const aspect = width && height ? width / height : 16 / 9;
  return { duration, width, height, aspect };
}

/** Camera-generated edit proxy beside the source (for example DJI `.LRF`). */
export function nativeCompanionProxy(path: string): Promise<string | null> {
  return invoke<string | null>("companion_proxy", { path });
}

const PROXY_POLL_MS = 500;
const PROXY_TIMEOUT_MS = 15 * 60 * 1000;

/**
 * A fast, low-res H.264 transcode with dense keyframes: cheap to decode for
 * playback compared to a 4K HEVC original. `start_proxy` returns immediately
 * (the transcode itself runs in the background), so this polls `proxy_status`
 * until ffprobe can confirm the output is a complete, valid file — resolving
 * only once the proxy is genuinely ready to use. Resolves to the proxy file's
 * path.
 */
export async function nativeMakeProxy(path: string): Promise<string> {
  const outPath = await invoke<string>("start_proxy", { path });
  const deadline = Date.now() + PROXY_TIMEOUT_MS;
  for (;;) {
    const status = await invoke<"pending" | "ready" | "failed">(
      "proxy_status",
      { outPath },
    );
    if (status === "ready") return outPath;
    if (status === "failed") throw new Error("proxy generation failed");
    if (Date.now() >= deadline) {
      throw new Error("proxy generation timed out");
    }
    await new Promise((r) => setTimeout(r, PROXY_POLL_MS));
  }
}

interface Thumb {
  time: number;
  path: string;
}

const THUMB_POLL_MS = 120;

interface ThumbnailBatch {
  thumbs: Thumb[];
  done: boolean;
  failed: boolean;
}

interface WaveformBatch {
  peaks: number[];
  nextPeak: number;
  done: boolean;
  failed: boolean;
}

const WAVEFORM_POLL_MS = 120;
const RAW_WAVEFORM_PEAKS_PER_SECOND = 8000 / 67;

/**
 * A whole filmstrip via ffmpeg, streamed in as frames land instead of
 * blocking on one full pass — mirrors `generateFilmstrip`'s progressive
 * contract so callers can treat the native and browser paths uniformly.
 */
export async function nativeThumbnailsStream(
  path: string,
  aspect: number,
  duration: number,
  onProgress: (strip: Filmstrip) => void,
  cancelled: () => boolean,
  fps = 1.5,
  height = 96,
): Promise<void> {
  // A useful overview matters more than hundreds of nearly-identical frames.
  // Cap the initial strip and let native ffmpeg seek to those positions in
  // parallel, so the end of a long timeline appears with the beginning.
  const samplingFps = Math.min(fps, 24 / Math.max(duration, 0.001));
  const dir = await invoke<string>("start_thumbnails", {
    path,
    fps: samplingFps,
    height,
    duration,
  });
  let lastCount = 0;

  while (!cancelled()) {
    const batch = await invoke<ThumbnailBatch>("list_thumbnails", {
      dir,
      fps: samplingFps,
    });
    if (cancelled()) return;
    const { thumbs } = batch;
    if (thumbs.length > lastCount) {
      lastCount = thumbs.length;
      onProgress({
        frames: thumbs.map((t) => ({ time: t.time, src: assetUrl(t.path) })),
        aspect,
      });
    }
    if (batch.done) return;
    if (batch.failed) throw new Error("thumbnail generation failed");
    await new Promise((r) => setTimeout(r, THUMB_POLL_MS));
  }
}

/**
 * Decode and reveal a desktop waveform while ffmpeg is still walking the
 * source. Unfilled buckets stay NaN so the canvas leaves the future portion
 * blank instead of stretching the available prefix across the whole clip.
 */
export async function nativeWaveformStream(
  path: string,
  duration: number,
  onProgress: (peaks: number[]) => void,
  cancelled: () => boolean,
): Promise<void> {
  const dir = await invoke<string>("start_waveform", { path });
  const displayCount = Math.min(
    30000,
    Math.max(600, Math.round(duration * 120)),
  );
  const rawCount = Math.max(
    1,
    Math.ceil(duration * RAW_WAVEFORM_PEAKS_PER_SECOND),
  );
  const display = new Array<number>(displayCount).fill(Number.NaN);
  let cursor = 0;

  while (!cancelled()) {
    const batch = await invoke<WaveformBatch>("list_waveform", {
      dir,
      startPeak: cursor,
    });
    if (cancelled()) return;
    if (batch.peaks.length > 0) {
      for (let i = 0; i < batch.peaks.length; i++) {
        const displayIndex = Math.min(
          displayCount - 1,
          Math.floor(((cursor + i) / rawCount) * displayCount),
        );
        const peak = batch.peaks[i];
        const previous = display[displayIndex];
        display[displayIndex] = Number.isFinite(previous)
          ? Math.max(previous, peak)
          : peak;
      }
      cursor = batch.nextPeak;
      onProgress([...display]);
    }
    if (batch.done) return;
    if (batch.failed) throw new Error("waveform generation failed");
    await new Promise((resolve) => setTimeout(resolve, WAVEFORM_POLL_MS));
  }
}

// The ffmpeg extraction itself — one full demux/encode pass — is the
// expensive, one-per-file part; everything after it (16kHz decode for VAD,
// upload for transcription, peak-bucketing for the waveform) is cheap by
// comparison. VAD, transcription, and the waveform each want these same
// bytes independently and typically all fire within moments of each other
// right after upload. Caching the IN-FLIGHT PROMISE (not just the resolved
// bytes) is what makes concurrent callers share one ffmpeg process instead
// of each spawning their own for the identical file.
const audioBytesCache = new Map<string, Promise<ArrayBuffer>>();
const AUDIO_CACHE_LIMIT = 3;

function extractAudioBytes(path: string): Promise<ArrayBuffer> {
  let pending = audioBytesCache.get(path);
  if (!pending) {
    pending = invoke<ArrayBuffer>("extract_audio_bytes", { path });
    audioBytesCache.set(path, pending);
    while (audioBytesCache.size > AUDIO_CACHE_LIMIT) {
      const oldest = audioBytesCache.keys().next().value;
      if (oldest === undefined || oldest === path) break;
      audioBytesCache.delete(oldest);
    }
    // Don't cache a failure — let the next caller retry from scratch.
    pending.catch(() => audioBytesCache.delete(path));
  }
  return pending;
}

/**
 * One ffmpeg-extracted mono audio file, returned as a Blob. Used to
 * transcribe the whole take in a single request instead of the in-browser
 * decode + chunk-and-stitch path.
 */
export async function nativeAudioBlob(path: string): Promise<Blob> {
  const buf = await extractAudioBytes(path);
  return new Blob([buf], { type: "audio/mp4" });
}

/** Native mono 16 kHz float PCM for VAD and trim analysis. */
export async function nativePcm16k(path: string): Promise<Float32Array> {
  const { byteLength } = await invoke<{ byteLength: number }>("prepare_pcm", {
    path,
  });
  if (byteLength <= 0 || byteLength % Float32Array.BYTES_PER_ELEMENT !== 0) {
    throw new Error("invalid native PCM byte length");
  }
  const output = new Uint8Array(byteLength);
  const chunkSize = 2 * 1024 * 1024;
  for (let offset = 0; offset < byteLength; offset += chunkSize) {
    const length = Math.min(chunkSize, byteLength - offset);
    const response = await invoke<ArrayBuffer | Uint8Array>(
      "extract_pcm_chunk",
      { path, offset, length },
    );
    const chunk =
      response instanceof ArrayBuffer ? new Uint8Array(response) : response;
    if (!(chunk instanceof Uint8Array) || chunk.byteLength !== length) {
      throw new Error("invalid native PCM chunk");
    }
    output.set(chunk, offset);
  }
  return new Float32Array(output.buffer);
}

/**
 * Waveform peaks decoded from the same extraction transcription/VAD use —
 * see `extractAudioBytes` — instead of a second full ffmpeg pass over the
 * video file.
 */
export async function nativeWaveform(
  path: string,
  duration: number,
): Promise<number[]> {
  const bytes = await extractAudioBytes(path);
  return waveformFromBytes(bytes, duration);
}
