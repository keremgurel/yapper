"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  clipDuration,
  sourceToTimeline,
  timelineToSource,
  totalDuration,
} from "@/lib/studio/clips";
import { useFilmstrip, type Frame } from "@/hooks/use-filmstrip";
import type { Clip } from "@/lib/studio/types";

function framesForClip(frames: Frame[], clip: Clip): Frame[] {
  return frames.filter((f) => f.time >= clip.start && f.time <= clip.end);
}

export default function StudioTimeline({
  clips,
  sourceUrl,
  sourceDuration,
  currentSourceTime,
  selectedClipId,
  onSelect,
  onSeekSource,
}: {
  clips: Clip[];
  sourceUrl: string;
  sourceDuration: number;
  currentSourceTime: number;
  selectedClipId: string | null;
  onSelect: (id: string) => void;
  onSeekSource: (t: number) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [scrubbing, setScrubbing] = useState(false);
  const total = totalDuration(clips);
  const frames = useFilmstrip(sourceUrl, sourceDuration);

  const playheadPct =
    total > 0 ? (sourceToTimeline(clips, currentSourceTime) / total) * 100 : 0;

  const seekFromClientX = useCallback(
    (clientX: number) => {
      const el = trackRef.current;
      if (!el || total <= 0) return;
      const rect = el.getBoundingClientRect();
      const fraction = Math.min(
        1,
        Math.max(0, (clientX - rect.left) / rect.width),
      );
      onSeekSource(timelineToSource(clips, fraction * total));
    },
    [clips, total, onSeekSource],
  );

  useEffect(() => {
    if (!scrubbing) return;
    const onMove = (e: PointerEvent) => seekFromClientX(e.clientX);
    const onUp = () => setScrubbing(false);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [scrubbing, seekFromClientX]);

  return (
    <div className="select-none">
      <div ref={trackRef} className="relative">
        {/* Scrub ruler */}
        <div
          onPointerDown={(e) => {
            e.preventDefault();
            setScrubbing(true);
            seekFromClientX(e.clientX);
          }}
          className="bg-muted hover:bg-foreground/10 h-5 cursor-pointer rounded-t-md transition-colors"
        />

        {/* Filmstrip clips */}
        <div className="flex h-16 gap-0.5">
          {clips.map((clip) => {
            const widthPct = total > 0 ? (clipDuration(clip) / total) * 100 : 0;
            const selected = clip.id === selectedClipId;
            const clipFrames = framesForClip(frames, clip);
            return (
              <button
                key={clip.id}
                type="button"
                style={{ width: `${widthPct}%` }}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(clip.id);
                }}
                className={`bg-muted relative h-full min-w-[3px] overflow-hidden rounded-md transition-shadow ${
                  selected
                    ? "ring-2 ring-cyan-500"
                    : "ring-1 ring-transparent hover:ring-white/20"
                }`}
                title={`${clip.start.toFixed(1)}s – ${clip.end.toFixed(1)}s`}
              >
                {clipFrames.length > 0 ? (
                  <span className="flex h-full w-full">
                    {clipFrames.map((f) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={f.time}
                        src={f.src}
                        alt=""
                        draggable={false}
                        className="h-full min-w-0 flex-1 object-cover"
                      />
                    ))}
                  </span>
                ) : (
                  <span className="bg-foreground/15 block h-full w-full" />
                )}
              </button>
            );
          })}
        </div>

        {/* Playhead */}
        <div
          className="pointer-events-none absolute top-0 bottom-0 z-10 w-0.5 bg-red-500"
          style={{ left: `${playheadPct}%` }}
        >
          <span className="absolute -top-0.5 left-1/2 h-2 w-2 -translate-x-1/2 rounded-full bg-red-500" />
        </div>
      </div>
      <p className="text-foreground/45 mt-2 text-xs">
        {clips.length} {clips.length === 1 ? "clip" : "clips"} · drag the ruler
        to scrub · click a clip to select
      </p>
    </div>
  );
}
