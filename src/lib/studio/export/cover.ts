/** The source-rectangle to sample so that `src` fills `dest` like CSS
 * `object-cover` (fill the box, center-crop the overflow). Returned in the
 * source's own pixel space for use as the sx/sy/sw/sh args of drawImage. */
export function coverSourceRect(
  srcW: number,
  srcH: number,
  destW: number,
  destH: number,
): { sx: number; sy: number; sw: number; sh: number } {
  if (srcW <= 0 || srcH <= 0 || destW <= 0 || destH <= 0) {
    return { sx: 0, sy: 0, sw: Math.max(1, srcW), sh: Math.max(1, srcH) };
  }
  const scale = Math.max(destW / srcW, destH / srcH);
  const sw = destW / scale;
  const sh = destH / scale;
  return {
    sx: (srcW - sw) / 2,
    sy: (srcH - sh) / 2,
    sw,
    sh,
  };
}

/** Draw `el` into the dest box on `ctx` with object-cover semantics. */
export function drawCover(
  ctx: CanvasRenderingContext2D,
  el: CanvasImageSource,
  srcW: number,
  srcH: number,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
): void {
  const { sx, sy, sw, sh } = coverSourceRect(srcW, srcH, dw, dh);
  ctx.drawImage(el, sx, sy, sw, sh, dx, dy, dw, dh);
}
