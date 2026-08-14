import {
  decodeAudioChunks,
  type DecodedPcm,
} from "@/lib/studio/audio/decode-track";
import { demuxAudioTrackCached } from "@/lib/studio/audio/demux-cache";

/**
 * Extract a media file's audio as gapless PCM, demuxing with mp4box and decoding
 * with WebCodecs. This replaces Web Audio's decodeAudioData, which drops chunks
 * of audio on multi-track camera files and so corrupted the transcript. Results
 * are cached by URL (decoding is expensive and several features need it).
 */
const CACHE_BYTE_BUDGET = 96 * 1024 * 1024;
const cache = new Map<
  string,
  { promise: Promise<DecodedPcm>; bytes: number }
>();

function trimCache(): void {
  let bytes = [...cache.values()].reduce((sum, entry) => sum + entry.bytes, 0);
  while (bytes > CACHE_BYTE_BUDGET && cache.size > 0) {
    const oldest = cache.keys().next().value as string | undefined;
    if (!oldest) break;
    bytes -= cache.get(oldest)?.bytes ?? 0;
    cache.delete(oldest);
  }
}

export function extractPcm(
  url: string,
  signal?: AbortSignal,
): Promise<DecodedPcm> {
  if (signal) {
    return demuxAudioTrackCached(url, signal).then((audio) =>
      decodeAudioChunks(audio, signal),
    );
  }
  const cached = cache.get(url);
  if (cached) return cached.promise;
  const entry: typeof cache extends Map<string, infer Entry> ? Entry : never = {
    promise: Promise.resolve(undefined as unknown as DecodedPcm),
    bytes: 0,
  };
  const pending = (async () =>
    decodeAudioChunks(await demuxAudioTrackCached(url)))()
    .then((pcm) => {
      entry.bytes = pcm.channels.reduce(
        (sum, channel) => sum + channel.byteLength,
        0,
      );
      trimCache();
      return pcm;
    })
    .catch((e) => {
      cache.delete(url); // don't cache a failure — allow a retry / fallback
      throw e;
    });
  entry.promise = pending;
  cache.set(url, entry);
  return pending;
}

export function forgetExtractedPcm(url: string): void {
  cache.delete(url);
}
