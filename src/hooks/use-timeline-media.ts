"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  generateFilmstrip,
  generateWaveform,
  type Filmstrip,
} from "@/lib/studio/filmstrip";

/** A distinct piece of video on the timeline, whatever layer it sits on. */
export interface TimelineMedia {
  url: string;
  duration: number;
}

/** Stable identity for a media set, so an unrelated re-render doesn't restart work. */
function mediaKey(media: TimelineMedia[]): string {
  return media
    .map((m) => `${m.url}@${m.duration.toFixed(3)}`)
    .sort()
    .join("|");
}

/**
 * Thumbnails for every video on the timeline, keyed by URL — the recording, any
 * media appended to the bottom track, and any overlay's own footage all get a
 * real filmstrip. Strips are built one media at a time (each costs a long run of
 * video seeks) and stream in progressively, so the timeline fills as they land.
 */
export function useFilmstrips(media: TimelineMedia[]): Map<string, Filmstrip> {
  const key = mediaKey(media);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stable = useMemo(() => media, [key]);
  const [strips, setStrips] = useState<Map<string, Filmstrip>>(new Map());
  // Strips already built, so adding a second clip never regenerates the first.
  const builtRef = useRef<Map<string, Filmstrip>>(new Map());

  useEffect(() => {
    let cancelled = false;
    const wanted = new Set(stable.map((m) => m.url));

    // Drop strips for media that has left the timeline; keep the rest.
    for (const url of builtRef.current.keys()) {
      if (!wanted.has(url)) builtRef.current.delete(url);
    }
    setStrips(new Map(builtRef.current));

    void (async () => {
      for (const m of stable) {
        if (cancelled) return;
        if (builtRef.current.has(m.url)) continue;
        await generateFilmstrip(
          m.url,
          m.duration,
          (strip) => {
            builtRef.current.set(m.url, strip);
            setStrips(new Map(builtRef.current));
          },
          () => cancelled,
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [stable]);

  return strips;
}

/** Waveform peaks for every video on the timeline, keyed by URL. */
export function useWaveforms(media: TimelineMedia[]): Map<string, number[]> {
  const key = mediaKey(media);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stable = useMemo(() => media, [key]);
  const [waves, setWaves] = useState<Map<string, number[]>>(new Map());
  const builtRef = useRef<Map<string, number[]>>(new Map());

  useEffect(() => {
    let cancelled = false;
    const wanted = new Set(stable.map((m) => m.url));

    for (const url of builtRef.current.keys()) {
      if (!wanted.has(url)) builtRef.current.delete(url);
    }
    setWaves(new Map(builtRef.current));

    void (async () => {
      for (const m of stable) {
        if (cancelled) return;
        if (builtRef.current.has(m.url)) continue;
        const peaks = await generateWaveform(m.url, m.duration);
        if (cancelled) return;
        builtRef.current.set(m.url, peaks);
        setWaves(new Map(builtRef.current));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [stable]);

  return waves;
}
