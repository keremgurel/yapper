import {
  decodeAudioChunks,
  type DecodedPcm,
} from "@/lib/studio/audio/decode-track";
import { demuxAudioTrack } from "@/lib/studio/audio/demux-audio";

/**
 * Extract a media file's audio as gapless PCM, demuxing with mp4box and decoding
 * with WebCodecs. This replaces Web Audio's decodeAudioData, which drops chunks
 * of audio on multi-track camera files and so corrupted the transcript. Results
 * are cached by URL (decoding is expensive and several features need it).
 */
const CACHE_LIMIT = 2;
const cache = new Map<string, Promise<DecodedPcm>>();

export function extractPcm(url: string): Promise<DecodedPcm> {
  const cached = cache.get(url);
  if (cached) return cached;
  const pending = (async () =>
    decodeAudioChunks(await demuxAudioTrack(url)))().catch((e) => {
    cache.delete(url); // don't cache a failure — allow a retry / fallback
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

export function forgetExtractedPcm(url: string): void {
  cache.delete(url);
}
