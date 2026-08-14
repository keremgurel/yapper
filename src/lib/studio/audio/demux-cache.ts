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
const CACHE_BYTE_BUDGET = 48 * 1024 * 1024;
const cache = new Map<
  string,
  { promise: Promise<DemuxedAudio>; controller: AbortController; bytes: number }
>();

function trimCache(): void {
  let bytes = [...cache.values()].reduce((sum, entry) => sum + entry.bytes, 0);
  while (bytes > CACHE_BYTE_BUDGET && cache.size > 0) {
    const oldest = cache.keys().next().value as string | undefined;
    if (!oldest) break;
    const entry = cache.get(oldest);
    entry?.controller.abort("demux_cache_evicted");
    bytes -= entry?.bytes ?? 0;
    cache.delete(oldest);
  }
}

export function demuxAudioTrackCached(
  url: string,
  signal?: AbortSignal,
): Promise<DemuxedAudio> {
  // A caller-owned cancellation signal cannot safely share a promise with
  // unrelated consumers. Cancellable jobs take an isolated path; ordinary
  // editor analysis retains the small LRU.
  if (signal) return demuxAudioTrack(url, signal);
  const cached = cache.get(url);
  if (cached) return cached.promise;
  const controller = new AbortController();
  const entry: typeof cache extends Map<string, infer Entry> ? Entry : never = {
    controller,
    bytes: 0,
    promise: Promise.resolve(undefined as unknown as DemuxedAudio),
  };
  const pending = demuxAudioTrack(url, controller.signal)
    .then((audio) => {
      entry.bytes = audio.chunks.reduce(
        (sum, chunk) => sum + chunk.data.byteLength,
        0,
      );
      trimCache();
      return audio;
    })
    .catch((e) => {
      cache.delete(url); // don't cache a failure — allow a retry / fallback
      throw e;
    });
  entry.promise = pending;
  cache.set(url, entry);
  return pending;
}

export function forgetDemuxedAudio(url: string): void {
  cache.get(url)?.controller.abort("demux_source_forgotten");
  cache.delete(url);
}
