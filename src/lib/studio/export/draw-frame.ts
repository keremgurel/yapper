import { drawCaption } from "@/lib/studio/export/draw-caption";
import { drawCover } from "@/lib/studio/export/cover";
import { croppedSourceRect } from "@/lib/studio/crop";
import type { CaptionFrame } from "@/lib/studio/export/frame-plan";
import type { OverlayRect } from "@/lib/studio/types";

/** A media element ready to draw, with its intrinsic pixel size. */
export interface DrawItem {
  el: CanvasImageSource;
  naturalW: number;
  naturalH: number;
}

export interface FrameContent {
  base: DrawItem | null;
  overlays: Array<
    DrawItem & { x: number; y: number; w: number; h: number; crop: OverlayRect }
  >;
  caption: CaptionFrame | null;
}

/**
 * Paint one output frame: black backdrop, base track (object-cover, so a base
 * whose aspect matches the canvas fills it with no crop or letterbox), then
 * overlays in paint order, then the caption. Mirrors the live preview stack.
 */
export function drawFrame(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  content: FrameContent,
): void {
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, width, height);

  if (content.base) {
    const { el, naturalW, naturalH } = content.base;
    drawCover(ctx, el, naturalW, naturalH, 0, 0, width, height);
  }

  for (const ov of content.overlays) {
    const dx = ov.x * width;
    const dy = ov.y * height;
    const dw = ov.w * width;
    const dh = ov.h * height;
    if (dw <= 0 || dh <= 0) continue;
    ctx.save();
    ctx.beginPath();
    ctx.rect(dx, dy, dw, dh);
    ctx.clip();
    // Crop first, then cover what is left into the box: the same order the
    // preview lays the media out in.
    const { sx, sy, sw, sh } = croppedSourceRect(
      ov.naturalW,
      ov.naturalH,
      ov.crop,
      dw,
      dh,
    );
    ctx.drawImage(ov.el, sx, sy, sw, sh, dx, dy, dw, dh);
    ctx.restore();
  }

  if (content.caption) {
    drawCaption(ctx, content.caption, width, height);
  }
}
