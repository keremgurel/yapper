import type { StudioSource } from "@/lib/studio/types";

// Fallback short side when no media ever reported dimensions.
const FALLBACK_SHORT = 1080;
// Guard against exceeding common H.264 encoder limits; only ever downscales.
const MAX_LONG_SIDE = 3840;

const toEven = (n: number) => Math.max(2, Math.round(n / 2) * 2);

/** The source's own shorter side, or a sane default when it has no dimensions. */
export function nativeShortSide(source: StudioSource | null): number {
  if (source?.width && source?.height) {
    return Math.min(source.width, source.height);
  }
  return FALLBACK_SHORT;
}

/**
 * Output size for the export: the project's chosen `aspect` (width / height) at
 * the source's native detail level, so there is no resolution loss. The frame
 * shape comes from the project, never from whatever media happens to sit on the
 * bottom track. Only clamped down if a side exceeds encoder limits (never
 * upscaled), and rounded to even numbers as H.264 requires.
 */
export function outputDimensions(
  source: StudioSource | null,
  aspect: number,
  shortSide?: number,
): {
  width: number;
  height: number;
} {
  const native = nativeShortSide(source);
  const short = Math.min(native, shortSide ?? native);

  const portrait = aspect < 1;
  let w = portrait ? short : short * aspect;
  let h = portrait ? short / aspect : short;

  const longSide = Math.max(w, h);
  if (longSide > MAX_LONG_SIDE) {
    const scale = MAX_LONG_SIDE / longSide;
    w *= scale;
    h *= scale;
  }

  return { width: toEven(w), height: toEven(h) };
}

/**
 * Scale a size down so its longest side is at most `target`, preserving aspect
 * ratio and keeping even dimensions. Never upscales — a size already within the
 * target is returned unchanged. Used as an export fallback when the encoder
 * can't handle the native frame size.
 */
export function scaleLongSide(
  size: { width: number; height: number },
  target: number,
): { width: number; height: number } {
  const longSide = Math.max(size.width, size.height);
  if (longSide <= target) return size;
  const scale = target / longSide;
  return {
    width: toEven(size.width * scale),
    height: toEven(size.height * scale),
  };
}
