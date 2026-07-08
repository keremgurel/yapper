import type { StudioSource } from "@/lib/studio/types";

// Fallback portrait size when the source never reported dimensions.
const FALLBACK_W = 1080;
const FALLBACK_H = 1920;
// Guard against exceeding common H.264 encoder limits; only ever downscales.
const MAX_LONG_SIDE = 3840;

const toEven = (n: number) => Math.max(2, Math.round(n / 2) * 2);

/**
 * Output size for the export: the source's own native pixel dimensions, so
 * there is no resolution loss. Only clamped down if a side exceeds encoder
 * limits (never upscaled), and rounded to even numbers as H.264 requires.
 */
export function outputDimensions(
  source: StudioSource,
  shortSide?: number,
): {
  width: number;
  height: number;
} {
  let w = source.width && source.height ? source.width : FALLBACK_W;
  let h = source.width && source.height ? source.height : FALLBACK_H;

  const longSide = Math.max(w, h);
  if (longSide > MAX_LONG_SIDE) {
    const scale = MAX_LONG_SIDE / longSide;
    w *= scale;
    h *= scale;
  }

  // Optional user-chosen resolution: scale so the shorter side matches (never up).
  const shorter = Math.min(w, h);
  if (shortSide && shorter > shortSide) {
    const scale = shortSide / shorter;
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
