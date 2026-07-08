import type { CaptionStyle } from "@/lib/studio/captions";
import type {
  AudioTrack,
  Caption,
  Clip,
  Overlay,
  StudioSource,
} from "@/lib/studio/types";

/** Everything the exporter needs to reproduce the editor preview as a file. */
export interface ExportInput {
  source: StudioSource;
  clips: Clip[];
  overlays: Overlay[];
  captions: Caption[];
  captionStyle: CaptionStyle;
  audioTracks: AudioTrack[];
}

/** Tunables. Defaults aim for visually lossless at the source's native size. */
export interface ExportOptions {
  /** Output frame rate. 30 matches the recorder. */
  fps: number;
  /** Bits per pixel per frame. Higher = closer to lossless, bigger file. */
  bitsPerPixel: number;
  /** Hard ceiling on the computed video bitrate (bps). */
  maxVideoBitrate: number;
  /**
   * Target for the frame's SHORTER side (e.g. 1080 → 1080x1920 for a portrait
   * clip). Undefined keeps the source's native resolution. Only ever downscales.
   */
  shortSide?: number;
}

export const DEFAULT_EXPORT_OPTIONS: ExportOptions = {
  fps: 30,
  // ~0.2 bpp is visually lossless for camera footage; the recorder itself
  // captures at ~12 Mbps for 1080x1920x30 (~0.19 bpp), so we match or exceed it.
  bitsPerPixel: 0.22,
  maxVideoBitrate: 80_000_000,
};

export type ExportPhase =
  | "preparing"
  | "audio"
  | "video"
  | "finalizing"
  | "done";

export interface ExportProgress {
  phase: ExportPhase;
  /** 0..1 within the current phase (video phase is the long one). */
  ratio: number;
}

/** Thrown when the browser can't run the WebCodecs export path. */
export class ExportUnsupportedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExportUnsupportedError";
  }
}
