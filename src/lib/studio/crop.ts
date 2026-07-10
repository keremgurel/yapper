import type { OverlayRect } from "@/lib/studio/types";

/** The whole picture. What an overlay shows until someone crops it. */
export const FULL_CROP: OverlayRect = { x: 0, y: 0, w: 1, h: 1 };

/** No crop rectangle can be smaller than this, as a fraction of the media. */
export const MIN_CROP = 0.05;

/** A crop rectangle in the media's own fractions, kept inside the media. */
export function clampCrop(crop: OverlayRect): OverlayRect {
  const w = Math.min(1, Math.max(MIN_CROP, crop.w));
  const h = Math.min(1, Math.max(MIN_CROP, crop.h));
  return {
    w,
    h,
    x: Math.min(1 - w, Math.max(0, crop.x)),
    y: Math.min(1 - h, Math.max(0, crop.y)),
  };
}

/** True when the crop takes nothing away. */
export function isFullCrop(crop: OverlayRect | undefined): boolean {
  return (
    !crop || (crop.x === 0 && crop.y === 0 && crop.w === 1 && crop.h === 1)
  );
}

/**
 * The source rectangle to sample so the CROPPED region of the media fills the
 * destination box like object-cover. In the media's own pixel space, ready for
 * the sx/sy/sw/sh arguments of `drawImage`.
 *
 * The crop is applied first and the cover is computed against what survives, so
 * cropping changes what is shown without changing where the box sits.
 */
export function croppedSourceRect(
  srcW: number,
  srcH: number,
  crop: OverlayRect,
  destW: number,
  destH: number,
): { sx: number; sy: number; sw: number; sh: number } {
  const cw = crop.w * srcW;
  const ch = crop.h * srcH;
  if (cw <= 0 || ch <= 0 || destW <= 0 || destH <= 0) {
    return { sx: 0, sy: 0, sw: Math.max(1, srcW), sh: Math.max(1, srcH) };
  }
  const scale = Math.max(destW / cw, destH / ch);
  const sw = destW / scale;
  const sh = destH / scale;
  return {
    sx: crop.x * srcW + (cw - sw) / 2,
    sy: crop.y * srcH + (ch - sh) / 2,
    sw,
    sh,
  };
}

/** Where to put the media element inside its box, as fractions of that box. */
export interface CropStyle {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * The same cover-of-a-crop, expressed as a position for the whole media element
 * inside an overflow-hidden box. The element is laid out at its natural aspect
 * and shifted so the crop rectangle lands over the box, which is what the export
 * draws. Both aspects are width / height.
 *
 * With no crop this reduces to plain object-cover, so nothing about an uncropped
 * overlay changes.
 */
export function cropStyle(
  crop: OverlayRect,
  mediaAspect: number,
  boxAspect: number,
): CropStyle {
  if (!mediaAspect || !boxAspect || crop.w <= 0 || crop.h <= 0) {
    return { left: 0, top: 0, width: 1, height: 1 };
  }
  // The shape of what the crop left behind.
  const croppedAspect = mediaAspect * (crop.w / crop.h);
  // Cover: the cropped region matches the box on one axis and overflows on the
  // other. Sizes here are fractions of the box.
  const cropW = croppedAspect >= boxAspect ? croppedAspect / boxAspect : 1;
  const cropH = croppedAspect >= boxAspect ? 1 : boxAspect / croppedAspect;
  // The crop is that fraction of the whole media, so the media is this big.
  const width = cropW / crop.w;
  const height = cropH / crop.h;
  return {
    width,
    height,
    left: -crop.x * width + (1 - cropW) / 2,
    top: -crop.y * height + (1 - cropH) / 2,
  };
}
