"use client";

import { useEffect, useState } from "react";

export interface Frame {
  time: number; // source seconds
  src: string; // data URL
}

export interface Filmstrip {
  frames: Frame[];
  aspect: number; // frame width / height, for sizing tiles
}

/**
 * Generate evenly-spaced thumbnail frames from a video URL, entirely in-browser
 * (offscreen <video> + <canvas>). Frames stream in progressively. Density scales
 * with duration so a windowed (tiled) timeline can show distinct frames when
 * zoomed in instead of stretching a few thumbnails. Returns empty on failure so
 * the timeline can fall back to plain blocks.
 */
export function useFilmstrip(
  url: string | undefined,
  duration: number,
): Filmstrip {
  const [frames, setFrames] = useState<Frame[]>([]);
  const [aspect, setAspect] = useState(16 / 9);

  useEffect(() => {
    // Reset when the source changes so stale frames don't linger.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFrames([]);
    if (!url || !duration || !Number.isFinite(duration) || duration <= 0) {
      return;
    }

    let cancelled = false;
    const video = document.createElement("video");
    video.src = url;
    video.muted = true;
    video.preload = "auto";

    const seek = (t: number) =>
      new Promise<void>((resolve) => {
        const onSeeked = () => {
          video.removeEventListener("seeked", onSeeked);
          resolve();
        };
        video.addEventListener("seeked", onSeeked);
        video.currentTime = Math.min(t, Math.max(0, duration - 0.05));
      });

    const run = async () => {
      // ~1.5 frames/sec keeps zoomed-in tiles distinct without too many seeks.
      const n = Math.min(120, Math.max(12, Math.round(duration * 1.5)));
      const ratio =
        video.videoWidth && video.videoHeight
          ? video.videoWidth / video.videoHeight
          : 16 / 9;
      if (!cancelled) setAspect(ratio);
      const h = 72;
      const w = Math.round(h * ratio);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const collected: Frame[] = [];
      for (let i = 0; i < n; i++) {
        if (cancelled) return;
        const t = ((i + 0.5) * duration) / n;
        try {
          await seek(t);
          ctx.drawImage(video, 0, 0, w, h);
          collected.push({ time: t, src: canvas.toDataURL("image/jpeg", 0.6) });
          if (!cancelled) setFrames([...collected]);
        } catch {
          // skip this frame
        }
      }
    };

    const onLoaded = () => {
      void run();
    };
    video.addEventListener("loadeddata", onLoaded, { once: true });

    return () => {
      cancelled = true;
      video.removeEventListener("loadeddata", onLoaded);
      video.removeAttribute("src");
      video.load();
    };
  }, [url, duration]);

  return { frames, aspect };
}
