"use client";

import { useEffect, useState } from "react";
import type { Caption } from "@/lib/studio/types";

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
export default function CaptionTrack({
  captions,
  pxPerSec,
  playhead,
  selectedId,
  onSelect,
  onRange,
  onSplit,
}: {
  captions: Caption[];
  pxPerSec: number;
  playhead: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onRange: (id: string, start: number, end: number) => void;
  onSplit: (id: string, at: number) => void;
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
    <div className="relative h-9">
      {captions.map((c) => {
        const left = c.start * pxPerSec;
        const width = Math.max((c.end - c.start) * pxPerSec, 8);
        const selected = selectedId === c.id;
        return (
          <div
            key={c.id}
            style={{ left, width }}
            onClick={() => onSelect(c.id)}
            onDoubleClick={() => onSplit(c.id, playhead)}
            title="Double-click to break at the playhead"
            className={`group absolute inset-y-0 flex cursor-pointer items-center overflow-hidden rounded-md bg-orange-500/25 px-2 ring-1 ${
              selected ? "ring-2 ring-orange-400" : "ring-orange-500/50"
            }`}
          >
            <span className="text-foreground/85 min-w-0 flex-1 truncate text-[11px] font-bold">
              {c.text}
            </span>
            <span
              onPointerDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onSelect(c.id);
                setTrim({
                  id: c.id,
                  edge: "start",
                  startX: e.clientX,
                  origStart: c.start,
                  origEnd: c.end,
                });
              }}
              className="absolute inset-y-0 left-0 z-10 w-2 cursor-ew-resize rounded-l bg-orange-300/70 opacity-0 group-hover:opacity-100"
            />
            <span
              onPointerDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onSelect(c.id);
                setTrim({
                  id: c.id,
                  edge: "end",
                  startX: e.clientX,
                  origStart: c.start,
                  origEnd: c.end,
                });
              }}
              className="absolute inset-y-0 right-0 z-10 w-2 cursor-ew-resize rounded-r bg-orange-300/70 opacity-0 group-hover:opacity-100"
            />
          </div>
        );
      })}
    </div>
  );
}
