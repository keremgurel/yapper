"use client";

import { memo, useEffect, useState } from "react";
import {
  captionTimelineRange,
  caseTransform,
  type CaptionCase,
} from "@/lib/studio/captions";
import type { Caption, Clip } from "@/lib/studio/types";

const MIN = 0.1;

interface CaptionTrim {
  id: string;
  edge: "start" | "end";
  startX: number;
  origStart: number;
  origEnd: number;
}

/**
 * The caption track row in the timeline: each caption is a clip you can select,
 * trim by its edges, or double-click to break in two at the playhead.
 */
function CaptionTrack({
  captions,
  clips,
  pxPerSec,
  playhead,
  selectedIds,
  textCase,
  onSelect,
  onRange,
  onSplit,
  lane = "caption",
}: {
  captions: Caption[];
  clips: Clip[];
  pxPerSec: number;
  playhead: number;
  selectedIds: string[];
  textCase: CaptionCase;
  onSelect: (id: string, additive: boolean) => void;
  onRange: (id: string, start: number, end: number) => void;
  onSplit: (id: string, at: number) => void;
  lane?: "caption" | "hook";
}) {
  const [trim, setTrim] = useState<CaptionTrim | null>(null);

  useEffect(() => {
    if (!trim) return;
    const onMove = (e: PointerEvent) => {
      const delta = (e.clientX - trim.startX) / pxPerSec;
      if (trim.edge === "start") {
        const start = Math.max(
          0,
          Math.min(trim.origStart + delta, trim.origEnd - MIN),
        );
        onRange(trim.id, start, trim.origEnd);
      } else {
        const end = Math.max(trim.origStart + MIN, trim.origEnd + delta);
        onRange(trim.id, trim.origStart, end);
      }
    };
    const onUp = () => setTrim(null);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [trim, pxPerSec, onRange]);

  return (
    <div
      className="bg-foreground/[0.025] relative h-8 rounded-md"
      aria-label={lane === "hook" ? "Text hooks track" : "Captions track"}
    >
      <span className="bg-background/75 text-muted-foreground pointer-events-none absolute top-1/2 left-2 z-20 -translate-y-1/2 rounded px-1.5 py-0.5 text-[8px] font-black tracking-wider uppercase opacity-0 backdrop-blur group-hover:opacity-100">
        {lane === "hook" ? "Hooks" : "Captions"}
      </span>
      {captions.map((c) => {
        const r = captionTimelineRange(clips, c);
        if (r.end <= r.start) return null; // fully cut
        const left = r.start * pxPerSec;
        const width = Math.max((r.end - r.start) * pxPerSec, 8);
        const selected = selectedIds.includes(c.id);
        return (
          <div
            key={c.id}
            style={{ left, width }}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => onSelect(c.id, e.metaKey || e.ctrlKey)}
            onDoubleClick={() => {
              if (lane === "caption") onSplit(c.id, playhead);
            }}
            title={
              lane === "hook"
                ? "Text hook · drag either edge to set its duration"
                : "Click to select · ⌘/Ctrl-click to multi-select · double-click to break at the playhead"
            }
            className={`group absolute inset-y-0 flex cursor-pointer items-center overflow-hidden rounded-md px-2 ring-1 ${
              lane === "hook" ? "bg-fuchsia-500/15" : "bg-amber-500/15"
            } ${
              selected
                ? lane === "hook"
                  ? "ring-2 ring-fuchsia-400"
                  : "ring-2 ring-amber-400"
                : lane === "hook"
                  ? "ring-fuchsia-500/35"
                  : "ring-amber-500/35"
            }`}
          >
            <span
              style={{ textTransform: caseTransform(textCase) }}
              className="text-foreground/85 min-w-0 flex-1 truncate text-[11px] font-bold"
            >
              {c.text}
            </span>
            <span
              onPointerDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onSelect(c.id, false);
                setTrim({
                  id: c.id,
                  edge: "start",
                  startX: e.clientX,
                  origStart: r.start,
                  origEnd: r.end,
                });
              }}
              className={`absolute inset-y-0 left-0 z-10 w-2 cursor-ew-resize rounded-l opacity-0 group-hover:opacity-100 ${
                lane === "hook" ? "bg-fuchsia-300/70" : "bg-amber-300/70"
              }`}
            />
            <span
              onPointerDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onSelect(c.id, false);
                setTrim({
                  id: c.id,
                  edge: "end",
                  startX: e.clientX,
                  origStart: r.start,
                  origEnd: r.end,
                });
              }}
              className={`absolute inset-y-0 right-0 z-10 w-2 cursor-ew-resize rounded-r opacity-0 group-hover:opacity-100 ${
                lane === "hook" ? "bg-fuchsia-300/70" : "bg-amber-300/70"
              }`}
            />
          </div>
        );
      })}
    </div>
  );
}

/** Skips re-rendering on a scroll-driven re-window (zoom, panning) when
 * nothing it actually reads — captions, clips, or the coarse playhead —
 * changed. Still re-renders on the coarse playhead tick, which is what
 * drives its active-caption highlight. */
export default memo(CaptionTrack);
