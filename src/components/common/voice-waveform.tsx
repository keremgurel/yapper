"use client";

import { useEffect, useRef } from "react";

/**
 * A live mic waveform drawn on a canvas: a scrolling HISTORY of what you have
 * said, newest column on the right, older columns sliding left and falling off
 * the edge. Silence renders as a small dot, so a quiet stretch reads as a
 * dotted line rather than a gap.
 *
 * Canvas on purpose: CSS flex bars with percentage heights silently collapse to
 * zero in Safari/WKWebView. This paints pixels directly, so it always shows and
 * reacts to the voice.
 *
 * Two things make the analyser actually receive audio: it resumes the context
 * every frame (a context created outside the click gesture starts suspended),
 * and it analyses a CLONE of the mic track, so the MediaRecorder using the same
 * track cannot starve Web Audio (a real Chrome behaviour).
 */

/** CSS pixels per column (bar + gap). Tuned to read as a dense strip. */
const COLUMN_PX = 4;
const BAR_PX = 2;
/** How often a new column is committed. Sets the scroll speed. */
const SAMPLE_MS = 55;

export default function VoiceWaveform({
  stream,
  className,
}: {
  stream: MediaStream | null;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  /** Committed column amplitudes, oldest first. Survives re-renders so the
   * history does not reset when the parent updates (e.g. the ticking timer). */
  const historyRef = useRef<number[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!stream || !canvas) {
      historyRef.current = [];
      return;
    }

    const audioStream = new MediaStream(
      stream.getAudioTracks().map((t) => t.clone()),
    );
    let raf = 0;
    let ctx: AudioContext | null = null;
    try {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!Ctor) return;
      const audio = new Ctor();
      ctx = audio;
      const source = audio.createMediaStreamSource(audioStream);
      const analyser = audio.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.55;
      source.connect(analyser);
      const mute = audio.createGain();
      mute.gain.value = 0;
      analyser.connect(mute);
      mute.connect(audio.destination);

      const n = analyser.fftSize;
      const data = new Uint8Array(n);
      const c2d = canvas.getContext("2d");
      if (!c2d) return;
      const waveformColor = getComputedStyle(canvas).color || "#ffffff";

      historyRef.current = [];
      // Peak accumulated since the last committed column, so a short loud
      // syllable between two samples still registers instead of being missed.
      let pending = 0;
      let lastCommit = performance.now();

      const draw = () => {
        if (audio.state === "suspended") void audio.resume().catch(() => {});
        analyser.getByteTimeDomainData(data);

        let peak = 0;
        for (let i = 0; i < n; i++) {
          const v = Math.abs(data[i] - 128) / 128;
          if (v > peak) peak = v;
        }
        if (peak > pending) pending = peak;

        const dpr = window.devicePixelRatio || 1;
        const cssW = canvas.clientWidth;
        const cssH = canvas.clientHeight;
        const w = Math.max(1, Math.round(cssW * dpr));
        const h = Math.max(1, Math.round(cssH * dpr));
        if (canvas.width !== w) canvas.width = w;
        if (canvas.height !== h) canvas.height = h;

        const columns = Math.max(1, Math.floor(cssW / COLUMN_PX));

        const now = performance.now();
        if (now - lastCommit >= SAMPLE_MS) {
          lastCommit = now;
          historyRef.current.push(pending);
          pending = 0;
          // Keep only what fits; the oldest column scrolls off the left edge.
          const overflow = historyRef.current.length - columns;
          if (overflow > 0) historyRef.current.splice(0, overflow);
        }

        c2d.clearRect(0, 0, w, h);
        c2d.fillStyle = waveformColor;

        const barW = Math.max(1, Math.round(BAR_PX * dpr));
        const step = COLUMN_PX * dpr;
        const radius = barW / 2;
        const rounded = typeof c2d.roundRect === "function";
        const history = historyRef.current;

        // Right-aligned: the newest column sits at the right edge and the
        // history trails off to the left, so growth reads as leftward motion.
        for (let i = 0; i < history.length; i++) {
          const fromRight = history.length - 1 - i;
          const x = Math.round(w - (fromRight + 1) * step + (step - barW) / 2);
          if (x + barW < 0) continue;
          // A floor of one bar-width makes silence a dot rather than nothing.
          const bh = Math.max(barW, Math.min(h, history[i] * 2.6 * h));
          const y = Math.round((h - bh) / 2);
          if (rounded) {
            c2d.beginPath();
            c2d.roundRect(x, y, barW, bh, radius);
            c2d.fill();
          } else {
            c2d.fillRect(x, y, barW, bh);
          }
        }
        raf = requestAnimationFrame(draw);
      };
      raf = requestAnimationFrame(draw);
    } catch {
      // The visualizer is optional; recording still works without it.
    }

    return () => {
      cancelAnimationFrame(raf);
      audioStream.getTracks().forEach((t) => t.stop());
      void ctx?.close().catch(() => {});
    };
  }, [stream]);

  return <canvas ref={canvasRef} className={className} aria-hidden />;
}
