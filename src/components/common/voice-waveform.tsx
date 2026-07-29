"use client";

import { useEffect, useRef } from "react";

/**
 * A live mic waveform drawn on a canvas. Canvas on purpose: CSS flex bars with
 * percentage heights silently collapse to zero in Safari/WKWebView. This paints
 * pixels directly, so it always shows and reacts to the voice.
 *
 * Two things make the analyser actually receive audio: it resumes the context
 * every frame (a context created outside the click gesture starts suspended),
 * and it analyses a CLONE of the mic track, so the MediaRecorder using the same
 * track cannot starve Web Audio (a real Chrome behaviour).
 */
export default function VoiceWaveform({
  stream,
  className,
}: {
  stream: MediaStream | null;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!stream || !canvas) return;

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
      const BARS = 24;

      const draw = () => {
        if (audio.state === "suspended") void audio.resume().catch(() => {});
        analyser.getByteTimeDomainData(data);

        const dpr = window.devicePixelRatio || 1;
        const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
        const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
        if (canvas.width !== w) canvas.width = w;
        if (canvas.height !== h) canvas.height = h;
        c2d.clearRect(0, 0, w, h);
        c2d.fillStyle = "#ffffff";

        const seg = Math.max(1, Math.floor(n / BARS));
        const barW = Math.max(2, Math.round(dpr * 2.5));
        const radius = barW / 2;
        const step = w / BARS;
        const rounded = typeof c2d.roundRect === "function";
        for (let b = 0; b < BARS; b++) {
          let peak = 0;
          for (let i = 0; i < seg; i++) {
            const v = Math.abs(data[b * seg + i] - 128) / 128;
            if (v > peak) peak = v;
          }
          const bh = Math.max(barW, Math.min(h, peak * 3 * h));
          const x = Math.round(b * step + (step - barW) / 2);
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
