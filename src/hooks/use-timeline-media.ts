"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  generateFilmstrip,
  generateWaveform,
  type Filmstrip,
} from "@/lib/studio/filmstrip";
import type { TimelineMedia } from "@/lib/studio/timeline-media";
import { isNative } from "@/lib/studio/native/bridge";
import {
  nativeThumbnailsStream,
  nativeWaveformStream,
} from "@/lib/studio/native/media";
import { nativeMediaForUrl } from "@/lib/studio/native/path-registry";

export type { TimelineMedia };

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

        // Desktop: pull the filmstrip via ffmpeg, streamed in as frames land.
        // Extraction starts immediately off the original file rather than
        // waiting for the low-res proxy — the proxy transcode itself blocks
        // for the full file (make_proxy) and can easily take longer than
        // decoding thumbnails straight from the source, so waiting for it
        // first only adds dead time before the first frame with nothing to
        // show for it. Uses the proxy only if it happens to already be ready
        // (a fast transcode, or a short clip). Falls through to the browser
        // generator on any failure, so nothing is worse than before a native
        // path existed.
        const native = isNative() ? nativeMediaForUrl(m.url) : undefined;
        if (native) {
          try {
            const path = native.proxyPath ?? native.path;
            await nativeThumbnailsStream(
              path,
              native.aspect,
              m.duration,
              (strip) => {
                builtRef.current.set(m.url, strip);
                setStrips(new Map(builtRef.current));
              },
              () => cancelled,
            );
            if (cancelled) return;
            continue;
          } catch {
            // fall back to the browser generator below
          }
        }

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

        // Desktop: decode the audio ffmpeg already pulled out for
        // transcription instead of fetching + decoding the whole video a
        // second time just for its audio track.
        const native = isNative() ? nativeMediaForUrl(m.url) : undefined;
        if (native) {
          try {
            await nativeWaveformStream(
              native.proxyPath ?? native.path,
              m.duration,
              (peaks) => {
                builtRef.current.set(m.url, peaks);
                setWaves(new Map(builtRef.current));
              },
              () => cancelled,
            );
            if (cancelled) return;
            continue;
          } catch {
            // fall back to the browser generator below
          }
        }

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
