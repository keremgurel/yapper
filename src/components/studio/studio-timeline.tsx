"use client";

import { useRef } from "react";
import {
  clipDuration,
  sourceToTimeline,
  timelineToSource,
  totalDuration,
} from "@/lib/studio/clips";
import type { Clip } from "@/lib/studio/types";

export default function StudioTimeline({
  clips,
  currentSourceTime,
  selectedClipId,
  onSelect,
  onSeekSource,
}: {
  clips: Clip[];
  currentSourceTime: number;
  selectedClipId: string | null;
  onSelect: (id: string) => void;
  onSeekSource: (t: number) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const total = totalDuration(clips);

  const playheadPct =
    total > 0 ? (sourceToTimeline(clips, currentSourceTime) / total) * 100 : 0;

  const seekFromEvent = (clientX: number) => {
    const el = trackRef.current;
    if (!el || total <= 0) return;
    const rect = el.getBoundingClientRect();
    const fraction = Math.min(
      1,
      Math.max(0, (clientX - rect.left) / rect.width),
    );
    onSeekSource(timelineToSource(clips, fraction * total));
  };

  return (
    <div className="select-none">
      <div
        ref={trackRef}
        onClick={(e) => seekFromEvent(e.clientX)}
        className="border-border bg-muted relative flex h-16 w-full gap-0.5 overflow-hidden rounded-xl border"
      >
        {clips.map((clip) => {
          const widthPct = total > 0 ? (clipDuration(clip) / total) * 100 : 0;
          const selected = clip.id === selectedClipId;
          return (
            <button
              key={clip.id}
              type="button"
              style={{ width: `${widthPct}%` }}
              onClick={(e) => {
                e.stopPropagation();
                onSelect(clip.id);
              }}
              onDoubleClick={(e) => e.stopPropagation()}
              className={`relative h-full min-w-[2px] rounded-md transition-colors ${
                selected
                  ? "bg-cyan-500/30 ring-2 ring-cyan-500"
                  : "bg-foreground/15 hover:bg-foreground/25"
              }`}
              title={`${clip.start.toFixed(1)}s – ${clip.end.toFixed(1)}s`}
            />
          );
        })}
        <div
          className="pointer-events-none absolute top-0 bottom-0 w-0.5 bg-red-500"
          style={{ left: `${playheadPct}%` }}
        />
      </div>
      <p className="text-foreground/45 mt-2 text-xs">
        {clips.length} {clips.length === 1 ? "clip" : "clips"} · click a clip to
        select, click the track to scrub
      </p>
    </div>
  );
}
