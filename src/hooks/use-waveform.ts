"use client";

import { useEffect, useState } from "react";

/**
 * Decode a media URL's audio and return normalized peak amplitudes (0–1) across
 * the full source duration, so the timeline can draw a waveform aligned to it.
 * Returns [] on failure (no audio / decode error).
 */
export function useWaveform(
  url: string | undefined,
  duration: number,
  buckets = 600,
): number[] {
  const [peaks, setPeaks] = useState<number[]>([]);

  useEffect(() => {
    setPeaks([]);
    if (!url || !duration || !Number.isFinite(duration) || duration <= 0) {
      return;
    }
    let cancelled = false;
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    const ctx = new AudioCtx();

    (async () => {
      try {
        const buf = await (await fetch(url)).arrayBuffer();
        const audio = await ctx.decodeAudioData(buf);
        const data = audio.getChannelData(0);
        const block = Math.max(1, Math.floor(data.length / buckets));
        const out: number[] = [];
        for (let i = 0; i < buckets; i++) {
          let max = 0;
          const s = i * block;
          const e = Math.min(s + block, data.length);
          for (let j = s; j < e; j++) {
            const a = Math.abs(data[j]);
            if (a > max) max = a;
          }
          out.push(max);
        }
        const peak = Math.max(0.01, ...out);
        if (!cancelled) setPeaks(out.map((v) => v / peak));
      } catch {
        // no audio track / decode failure -> leave empty
      } finally {
        void ctx.close();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [url, duration, buckets]);

  return peaks;
}
