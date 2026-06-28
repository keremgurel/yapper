"use client";

import { useEffect, useRef } from "react";

/**
 * Draws a precise, zoom-aware waveform for a clip's source range. Resolution
 * scales with the rendered width, so deeper zoom shows finer detail.
 */
export default function WaveformCanvas({
  peaks,
  sourceDuration,
  clipStart,
  clipEnd,
  width,
  height = 30,
}: {
  peaks: number[];
  sourceDuration: number;
  clipStart: number;
  clipEnd: number;
  width: number;
  height?: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || width <= 0 || peaks.length === 0 || sourceDuration <= 0) {
      return;
    }
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.floor(width * dpr));
    canvas.height = Math.max(1, Math.floor(height * dpr));
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "rgba(103,232,249,0.8)";

    const n = peaks.length;
    const startIdx = (clipStart / sourceDuration) * n;
    const endIdx = (clipEnd / sourceDuration) * n;
    const span = Math.max(1, endIdx - startIdx);

    const barW = Math.max(1, Math.round(1.6 * dpr));
    const step = barW + Math.max(1, Math.round(dpr));
    const mid = canvas.height / 2;

    for (let x = 0; x < canvas.width; x += step) {
      const i0 = Math.floor(startIdx + (x / canvas.width) * span);
      const i1 = Math.floor(startIdx + ((x + step) / canvas.width) * span);
      let max = 0;
      for (let i = i0; i <= i1 && i < n; i++) {
        if (peaks[i] > max) max = peaks[i];
      }
      const h = Math.max(dpr, max * canvas.height);
      ctx.fillRect(x, mid - h / 2, barW, h);
    }
  }, [peaks, sourceDuration, clipStart, clipEnd, width, height]);

  return <canvas ref={ref} style={{ width, height }} className="block" />;
}
