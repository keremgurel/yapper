import { ArrayBufferTarget, Muxer } from "mp4-muxer";
import { totalDuration } from "@/lib/studio/clips";
import { mixAudio } from "@/lib/studio/export/audio-mix";
import {
  outputDimensions,
  scaleLongSide,
} from "@/lib/studio/export/dimensions";
import { drawFrame, type DrawItem } from "@/lib/studio/export/draw-frame";
import {
  audioTrackConfig,
  encodeAudioBuffer,
} from "@/lib/studio/export/encode-audio";
import { createVideoChunkEncoder } from "@/lib/studio/export/encode-video";
import { baseAt, captionAt, overlaysAt } from "@/lib/studio/export/frame-plan";
import { MediaPool } from "@/lib/studio/export/media-pool";
import {
  isWebCodecsExportSupported,
  pickAvcCodec,
} from "@/lib/studio/export/support";
import {
  DEFAULT_EXPORT_OPTIONS,
  ExportUnsupportedError,
  type ExportInput,
  type ExportOptions,
  type ExportProgress,
} from "@/lib/studio/export/types";

const trackKey = (url: string) => `track:${url}`;
const overlayKey = (id: string) => `ov:${id}`;

/**
 * Render the edited timeline to an MP4 Blob entirely in the browser via
 * WebCodecs. Output is the source's native resolution (no resolution loss) at a
 * near-lossless bitrate. Throws ExportUnsupportedError when the browser lacks
 * WebCodecs, and AbortError when `signal` is aborted.
 */
export async function exportTimeline(
  input: ExportInput,
  {
    options = DEFAULT_EXPORT_OPTIONS,
    onProgress,
    signal,
  }: {
    options?: ExportOptions;
    onProgress?: (p: ExportProgress) => void;
    signal?: AbortSignal;
  } = {},
): Promise<Blob> {
  if (!isWebCodecsExportSupported()) {
    throw new ExportUnsupportedError(
      "This browser can't export video. Try the latest Chrome, Edge, or Safari.",
    );
  }

  const { source, clips, overlays, captions, captionStyle } = input;
  const duration = totalDuration(clips);
  if (duration <= 0)
    throw new Error("There's nothing on the timeline to export.");

  const { fps } = options;
  const frameCount = Math.max(1, Math.round(duration * fps));
  const frameDurUs = Math.round(1_000_000 / fps);
  const keyFrameEvery = fps * 2;

  // Native size first (no resolution loss). If no H.264 level encodes it (rare:
  // an encoder that can't do this frame size at all), step the long side down to
  // 1440 then 1080 and retry, so a huge source still exports rather than failing.
  const bitrateFor = (w: number, h: number) =>
    Math.min(
      options.maxVideoBitrate,
      Math.round(w * h * fps * options.bitsPerPixel),
    );
  const native = outputDimensions(source, options.shortSide);
  const attempts = [
    native,
    scaleLongSide(native, 1440),
    scaleLongSide(native, 1080),
  ];
  let width = native.width;
  let height = native.height;
  let bitrate = bitrateFor(width, height);
  let codec: string | null = null;
  for (const size of attempts) {
    const b = bitrateFor(size.width, size.height);
    const c = await pickAvcCodec(size.width, size.height, b, fps);
    if (c) {
      width = size.width;
      height = size.height;
      bitrate = b;
      codec = c;
      break;
    }
  }
  if (!codec) {
    throw new ExportUnsupportedError(
      "No supported H.264 encoder for this video size.",
    );
  }

  const throwIfAborted = () => {
    if (signal?.aborted)
      throw new DOMException("Export cancelled", "AbortError");
  };

  onProgress?.({ phase: "preparing", ratio: 0 });
  const pool = new MediaPool();

  try {
    // Preload every base-track source (base + any appended clip media).
    const trackSources = new Map<string, "video" | "image">();
    for (const clip of clips) {
      const url = clip.src?.url ?? source.url;
      const kind = clip.src?.kind ?? source.kind ?? "video";
      trackSources.set(url, kind);
    }
    for (const [url, kind] of trackSources) {
      throwIfAborted();
      await pool.load(trackKey(url), url, kind);
    }
    // Preload each visible overlay under its own key.
    for (const o of overlays) {
      if (o.hidden) continue;
      throwIfAborted();
      await pool.load(overlayKey(o.id), o.url, o.kind);
    }

    onProgress?.({ phase: "audio", ratio: 0 });
    const audioBuffer = await mixAudio(input);

    const target = new ArrayBufferTarget();
    const muxer = new Muxer({
      target,
      video: { codec: "avc", width, height, frameRate: fps },
      audio: audioBuffer
        ? { codec: "aac", ...audioTrackConfig(audioBuffer) }
        : undefined,
      fastStart: "in-memory",
    });

    if (audioBuffer) {
      throwIfAborted();
      await encodeAudioBuffer(audioBuffer, (chunk, meta) =>
        muxer.addAudioChunk(chunk, meta),
      );
    }

    const video = createVideoChunkEncoder(
      { codec, width, height, bitrate, framerate: fps },
      (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    );

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("Canvas 2D context unavailable.");

    for (let i = 0; i < frameCount; i++) {
      throwIfAborted();
      const t = i / fps;

      const base = baseAt(clips, source, t);
      let baseItem: DrawItem | null = null;
      if (base) {
        const m = pool.get(trackKey(base.url));
        if (m) {
          await m.seek(base.sourceTime);
          baseItem = { el: m.el, naturalW: m.naturalW, naturalH: m.naturalH };
        }
      }

      const overlayItems: FrameOverlay[] = [];
      for (const ov of overlaysAt(overlays, t)) {
        const m = pool.get(overlayKey(ov.id));
        if (!m) continue;
        await m.seek(ov.sourceTime);
        overlayItems.push({
          el: m.el,
          naturalW: m.naturalW,
          naturalH: m.naturalH,
          x: ov.x,
          y: ov.y,
          w: ov.w,
          h: ov.h,
        });
      }

      drawFrame(ctx, width, height, {
        base: baseItem,
        overlays: overlayItems,
        caption: captionAt(clips, captions, captionStyle, t),
      });

      const frame = new VideoFrame(canvas, {
        // Round each timestamp from the exact frame time, not i * roundedStep,
        // so the video clock can't drift against the sample-accurate audio.
        timestamp: Math.round((i * 1_000_000) / fps),
        duration: frameDurUs,
      });
      await video.encodeFrame(frame, i % keyFrameEvery === 0);

      if (i % 4 === 0) onProgress?.({ phase: "video", ratio: i / frameCount });
    }

    onProgress?.({ phase: "finalizing", ratio: 1 });
    await video.finish();
    muxer.finalize();
    onProgress?.({ phase: "done", ratio: 1 });
    return new Blob([target.buffer], { type: "video/mp4" });
  } finally {
    pool.destroy();
  }
}

type FrameOverlay = DrawItem & {
  x: number;
  y: number;
  w: number;
  h: number;
};
