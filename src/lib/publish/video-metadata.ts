import { ALL_FORMATS, Input, UrlSource } from "mediabunny";
import { presignView } from "@/lib/r2";

/** Probe only owned storage URLs; never accept a caller-supplied remote URL. */
export async function readPublishVideoMetadata(
  mediaKey: string,
  signal?: AbortSignal,
) {
  const url = await presignView(mediaKey, 600);
  const input = new Input({
    formats: ALL_FORMATS,
    source: new UrlSource(url, {
      maxCacheSize: 8 * 1024 * 1024,
      parallelism: 1,
      getRetryDelay: () => null,
      requestInit: { redirect: "error" },
    }),
  });
  const bounded = AbortSignal.any([
    signal ?? new AbortController().signal,
    AbortSignal.timeout(20_000),
  ]);
  const abort = () => input.dispose();
  bounded.addEventListener("abort", abort, { once: true });
  try {
    if (bounded.aborted) throw new Error("video_probe_aborted");
    const video = await input.getPrimaryVideoTrack();
    if (!video) throw new Error("video_track_missing");
    const [duration, width, height] = await Promise.all([
      input.computeDuration(),
      video.getDisplayWidth(),
      video.getDisplayHeight(),
    ]);
    if (!Number.isFinite(duration) || duration <= 0)
      throw new Error("video_duration_invalid");
    return { url, duration, width, height };
  } finally {
    bounded.removeEventListener("abort", abort);
    input.dispose();
  }
}
