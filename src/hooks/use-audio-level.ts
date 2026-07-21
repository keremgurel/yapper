"use client";

import { useEffect, useState } from "react";

/**
 * A live microphone level, 0-1, from the active stream's audio track via a Web
 * Audio analyser. Everything is wrapped so a browser without Web Audio (or a
 * suspended context) just yields 0 and never touches the recording. Re-keys on
 * `deviceId` so switching mics rebuilds the analyser on the new track.
 */
export function useAudioLevel(
  getStream: () => MediaStream | null,
  active: boolean,
  deviceId: string | null,
): number {
  const [level, setLevel] = useState(0);

  useEffect(() => {
    if (!active) return;
    const stream = getStream();
    if (!stream || stream.getAudioTracks().length === 0) return;

    let ctx: AudioContext | null = null;
    let raf = 0;
    try {
      ctx = new AudioContext();
      void ctx.resume();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);

      const loop = () => {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i += 1) {
          const v = (data[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / data.length);
        // Scale up: normal speech RMS is small, so lift it into a visible range.
        setLevel(Math.min(1, rms * 2.8));
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    } catch {
      // Web Audio unavailable — leave the level at 0, no meter.
    }

    return () => {
      cancelAnimationFrame(raf);
      ctx?.close().catch(() => {});
    };
    // `deviceId` is a dependency so a mic switch rebuilds the analyser.
  }, [active, getStream, deviceId]);

  return active ? level : 0;
}
