import type { CaptionCase } from "@/lib/studio/captions";
import { wrapLines } from "@/lib/studio/export/caption-wrap";
import type { CaptionFrame } from "@/lib/studio/export/frame-plan";

function applyCase(text: string, mode: CaptionCase): string {
  if (mode === "upper") return text.toUpperCase();
  if (mode === "lower") return text.toLowerCase();
  return text;
}

function colorWithOpacity(color: string, opacity: number): string {
  const hex = /^#([0-9a-f]{6})$/i.exec(color);
  if (!hex) return color;
  const value = Number.parseInt(hex[1], 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, opacity))})`;
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
  ctx.font = `${cap.fontWeight ?? 900} ${fontSize}px ${cap.fontFamily}`;
  ctx.textAlign = cap.textAlign ?? "center";
  ctx.textBaseline = "middle";

  const lines = wrapLines((s) => ctx.measureText(s).width, text, boxWidth);
  const startY = centerY - ((lines.length - 1) * lineHeight) / 2;
  const textX =
    cap.textAlign === "left"
      ? centerX - boxWidth / 2
      : cap.textAlign === "right"
        ? centerX + boxWidth / 2
        : centerX;
  const legacyBackground =
    cap.hookPreset === "white-card"
      ? "#ffffff"
      : cap.hookPreset === "black-card"
        ? "#090909"
        : "transparent";
  const backgroundColor = cap.backgroundColor ?? legacyBackground;

  if (cap.kind === "hook" && backgroundColor !== "transparent") {
    const widest = Math.min(
      boxWidth,
      Math.max(...lines.map((line) => ctx.measureText(line).width)),
    );
    const padX = fontSize * 0.72;
    const padY = fontSize * 0.52;
    const bgW = Math.min(canvasW * 0.96, widest + padX * 2);
    const bgH = lines.length * lineHeight + padY * 1.55;
    const left = centerX - bgW / 2;
    const top = centerY - bgH / 2;
    const radius = Math.min(fontSize * (cap.cornerRadius ?? 0.55), bgH / 2);
    ctx.beginPath();
    ctx.roundRect(left, top, bgW, bgH, radius);
    ctx.fillStyle = colorWithOpacity(
      backgroundColor,
      cap.backgroundOpacity ?? 1,
    );
    ctx.shadowColor = "rgba(0,0,0,0.24)";
    ctx.shadowBlur = Math.max(4, canvasH * 0.014);
    ctx.shadowOffsetY = Math.max(2, canvasH * 0.004);
    ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
  }

  // Pass 1: soft shadow for contrast. Pass 2: crisp white on top.
  const card = cap.kind === "hook" && backgroundColor !== "transparent";
  const legacyText =
    cap.kind === "hook" && cap.hookPreset === "white-card"
      ? "#090909"
      : "#ffffff";
  ctx.fillStyle = cap.textColor ?? legacyText;
  const shadow = cap.shadow !== false && !card;
  ctx.shadowColor = shadow ? "rgba(0,0,0,0.8)" : "transparent";
  ctx.shadowBlur = card ? 0 : Math.max(2, canvasH * 0.012);
  ctx.shadowOffsetY = card ? 0 : Math.max(1, canvasH * 0.003);
  lines.forEach((line, i) => {
    ctx.fillText(line, textX, startY + i * lineHeight);
  });

  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  lines.forEach((line, i) => {
    ctx.fillText(line, textX, startY + i * lineHeight);
  });
  ctx.restore();
}
