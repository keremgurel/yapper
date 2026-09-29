import { ALL_FORMATS, BufferSource, Input, UrlSource } from "mediabunny";

/** URLs must be server-signed owned-storage URLs, never arbitrary user input. */
export async function readOwnedAudioDuration(
  source: ArrayBuffer | string,
  signal?: AbortSignal,
): Promise<number> {
  const bounded = AbortSignal.any([
    AbortSignal.timeout(15_000),
    ...(signal ? [signal] : []),
  ]);
  const input = new Input({
    formats: ALL_FORMATS,
    source:
      typeof source === "string"
        ? new UrlSource(source, {
            maxCacheSize: 4 * 1024 * 1024,
            parallelism: 1,
            getRetryDelay: () => null,
            requestInit: { redirect: "error" },
          })
        : new BufferSource(source),
  });
  const abort = () => input.dispose();
  bounded.addEventListener("abort", abort, { once: true });
  try {
    if (bounded.aborted) throw new Error("audio_probe_aborted");
    if (!(await input.getPrimaryAudioTrack()))
      throw new Error("audio_track_missing");
    const duration = await input.computeDuration();
    if (!Number.isFinite(duration) || duration <= 0 || duration > 3600)
      throw new Error("invalid_audio_duration");
    return duration;
  } finally {
    bounded.removeEventListener("abort", abort);
    input.dispose();
  }
}

export function transcriptionUnits(duration: number): number {
  if (!Number.isFinite(duration) || duration <= 0 || duration > 3600)
    throw new Error("invalid_audio_duration");
  return Math.ceil(duration / 180);
}
