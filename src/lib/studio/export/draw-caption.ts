import type { CaptionCase } from "@/lib/studio/captions";
import { wrapLines } from "@/lib/studio/export/caption-wrap";
import type { CaptionFrame } from "@/lib/studio/export/frame-plan";

function applyCase(text: string, mode: CaptionCase): string {
  if (mode === "upper") return text.toUpperCase();
  if (mode === "lower") return text.toLowerCase();
  return text;
}

/**
 * Draw a caption onto `ctx`, reproducing the CaptionLayer look: centered,
 * font-black, the chosen family/case, wrapped to the box width, with the same
 * soft drop-shadow for legibility. Geometry is in the output canvas's pixels.
 */
export function drawCaption(
  ctx: CanvasRenderingContext2D,
  cap: CaptionFrame,
  canvasW: number,
  canvasH: number,
): void {
  const text = applyCase(cap.text, cap.textCase).trim();
  if (!text) return;

  const fontSize = cap.scale * canvasH;
  const boxWidth = cap.w * canvasW;
  const centerX = cap.x * canvasW;
  const centerY = cap.y * canvasH;
  const lineHeight = fontSize * 1.25;

  ctx.save();
  ctx.font = `900 ${fontSize}px ${cap.fontFamily}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const lines = wrapLines((s) => ctx.measureText(s).width, text, boxWidth);
  const startY = centerY - ((lines.length - 1) * lineHeight) / 2;

  // Pass 1: soft shadow for contrast. Pass 2: crisp white on top.
  ctx.fillStyle = "#ffffff";
  ctx.shadowColor = "rgba(0,0,0,0.8)";
  ctx.shadowBlur = Math.max(2, canvasH * 0.012);
  ctx.shadowOffsetY = Math.max(1, canvasH * 0.003);
  lines.forEach((line, i) => {
    ctx.fillText(line, centerX, startY + i * lineHeight);
  });

  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  lines.forEach((line, i) => {
    ctx.fillText(line, centerX, startY + i * lineHeight);
  });
  ctx.restore();
}
