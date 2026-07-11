import {
  demuxAudioTrack,
  type DemuxedAudio,
} from "@/lib/studio/audio/demux-audio";

/**
 * Cache demuxed audio by URL. Demuxing fetches and parses the whole media file
 * (a camera clip can be over a gigabyte), and both the transcription payload
 * (native AAC) and the local PCM decode need it — so without a cache the same
 * file would be fetched and parsed twice per transcribe.
 */
const CACHE_LIMIT = 2;
const cache = new Map<string, Promise<DemuxedAudio>>();

export function demuxAudioTrackCached(url: string): Promise<DemuxedAudio> {
  const cached = cache.get(url);
  if (cached) return cached;
  const pending = demuxAudioTrack(url).catch((e) => {
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

export function forgetDemuxedAudio(url: string): void {
  cache.delete(url);
}
