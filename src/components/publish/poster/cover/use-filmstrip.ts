"use client";

import { useEffect, useState } from "react";
import { captureTile, seekVideo } from "./frame-capture";

export interface FilmstripTile {
  time: number;
  src: string;
}

const TILE_HEIGHT = 72;

/**
 * Evenly spaced stills across the whole video, made on an offscreen element so
 * the visible player never jumps while they render. Twelve tiles is enough to
 * land within a few seconds of any moment; the scrubber and frame steps do the
 * rest.
 */
export function useFilmstrip(
  mediaUrl: string | null,
  duration: number,
  count = 12,
): { tiles: FilmstripTile[]; loading: boolean } {
  const [tiles, setTiles] = useState<FilmstripTile[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!mediaUrl || !duration) {
      setTiles([]);
      return;
    }
    let live = true;
    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.src = mediaUrl;
    setLoading(true);
    setTiles([]);

    void (async () => {
      try {
        await new Promise<void>((resolve, reject) => {
          video.addEventListener("loadeddata", () => resolve(), { once: true });
          video.addEventListener("error", () => reject(new Error("video")), {
            once: true,
          });
        });
        const made: FilmstripTile[] = [];
        for (let index = 0; index < count && live; index++) {
          // Centre of each slice, so the first tile is not the black lead-in.
          const time = ((index + 0.5) / count) * duration;
          await seekVideo(video, Math.min(time, Math.max(0, duration - 0.05)));
          made.push({ time, src: captureTile(video, TILE_HEIGHT) });
          if (live) setTiles([...made]);
        }
      } catch {
        // A filmstrip is a convenience; the scrubber still works without it.
      } finally {
        if (live) setLoading(false);
        video.removeAttribute("src");
        video.load();
      }
    })();

    return () => {
      live = false;
    };
  }, [mediaUrl, duration, count]);

  return { tiles, loading };
}
