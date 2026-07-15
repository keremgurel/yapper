"use client";

import { useEffect, useState } from "react";
import { Music2 } from "lucide-react";
import WaveformCanvas from "@/components/studio/waveform-canvas";
import { visibleSpan } from "@/lib/studio/window";
import { trimEndEdge, trimStartEdge } from "@/lib/studio/trim-edge";
import { newGestureId, type AudioTrack } from "@/lib/studio/types";

interface TrimState {
  edge: "start" | "end";
  startX: number;
  orig: { start: number; duration: number; sourceStart: number };
  /** Minted at pointerdown so the whole trim collapses into one undo step. */
  gesture: string;
}

/**
 * One audio clip on the timeline. Shows its own waveform (windowed to what is on
 * screen, like the video tracks) and drags sideways to reposition. Its edges
 * trim the played range in and out of the underlying file. It has no lane to
 * change, so unlike an overlay there is no vertical gesture and nothing to drop.
 */
export default function AudioClip({
  track,
  pxPerSec,
  visStartSec,
  visEndSec,
  peaks,
  selected,
  onSelect,
  onMoveStart,
  onTrim,
  snapTrimDelta,
}: {
  track: AudioTrack;
  pxPerSec: number;
  visStartSec: number;
  visEndSec: number;
  /** Waveform peaks for this track's own file (spanning its full media). */
  peaks: number[];
  selected: boolean;
  onSelect: (additive: boolean) => void;
  onMoveStart: (id: string, clientX: number, origStart: number) => void;
  onTrim: (
    id: string,
    start: number,
    duration: number,
    sourceStart: number,
    gesture: string,
  ) => void;
  /** Snap the dragged trim edge to a magnet, returning the adjusted delta. */
  snapTrimDelta: (
    edge: "start" | "end",
    start: number,
    duration: number,
    deltaSec: number,
    excludeId: string,
  ) => number;
}) {
  const a = track;
  const [trim, setTrim] = useState<TrimState | null>(null);

  useEffect(() => {
    if (!trim) return;
    const onMove = (e: PointerEvent) => {
      const raw = (e.clientX - trim.startX) / pxPerSec;
      const delta = snapTrimDelta(
        trim.edge,
        trim.orig.start,
        trim.orig.duration,
        raw,
        a.id,
      );
      const next =
        trim.edge === "start"
          ? trimStartEdge(trim.orig, delta, { min: 0, isImage: false })
          : trimEndEdge(trim.orig, delta, {
              max: Infinity,
              fullDuration: a.mediaDuration,
            });
      onTrim(a.id, next.start, next.duration, next.sourceStart, trim.gesture);
    };
    const onUp = () => setTrim(null);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [trim, pxPerSec, a.id, a.mediaDuration, onTrim, snapTrimDelta]);

  const beginTrim = (edge: "start" | "end") => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setTrim({
      edge,
      startX: e.clientX,
      orig: {
        start: a.start,
        duration: a.duration,
        sourceStart: a.sourceStart,
      },
      gesture: newGestureId(),
    });
  };

  const left = a.start * pxPerSec;
  const width = Math.max(a.duration * pxPerSec, 8);
  const span = visibleSpan(
    a.start,
    a.duration,
    a.sourceStart,
    a.sourceStart + a.duration,
    visStartSec,
    visEndSec,
    pxPerSec,
  );

  return (
    <div
      style={{ left, width }}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();
        // ⌘/Ctrl-click toggles selection without starting a drag.
        if (e.metaKey || e.ctrlKey) {
          onSelect(true);
          return;
        }
        // Plain click selects, but only when not already selected, so dragging
        // one clip of a multi-selection keeps the rest selected.
        if (!selected) onSelect(false);
        onMoveStart(a.id, e.clientX, a.start);
      }}
      onClick={(e) => {
        e.stopPropagation();
        if (!(e.metaKey || e.ctrlKey)) onSelect(false);
      }}
      className={`group absolute inset-y-0 cursor-grab overflow-hidden rounded-md bg-emerald-500/15 active:cursor-grabbing ${selected ? "ring-2 ring-cyan-500" : "ring-1 ring-emerald-500/35"} ${a.muted ? "opacity-40" : ""}`}
    >
      {span && peaks.length > 0 && a.mediaDuration > 0 && (
        <span
          className="pointer-events-none absolute inset-y-0 opacity-70"
          style={{ left: span.leftPx, width: span.widthPx }}
        >
          <WaveformCanvas
            peaks={peaks}
            sourceDuration={a.mediaDuration}
            clipStart={span.srcA}
            clipEnd={span.srcB}
            width={span.widthPx}
            height={32}
          />
        </span>
      )}
      <span className="pointer-events-none absolute inset-0 flex items-center gap-1.5 px-2">
        <Music2 className="h-3.5 w-3.5 shrink-0 text-emerald-300" />
        <span className="text-foreground/90 min-w-0 flex-1 truncate text-[11px] font-bold [text-shadow:0_1px_2px_rgba(0,0,0,0.85)]">
          {a.name}
        </span>
      </span>

      {/* Trim edges — drag to change the clip's in/out points. */}
      <span
        onPointerDown={beginTrim("start")}
        className="absolute inset-y-0 left-0 z-10 w-2 cursor-ew-resize bg-emerald-300/70 opacity-0 transition-opacity group-hover:opacity-100"
      />
      <span
        onPointerDown={beginTrim("end")}
        className="absolute inset-y-0 right-0 z-10 w-2 cursor-ew-resize bg-emerald-300/70 opacity-0 transition-opacity group-hover:opacity-100"
      />
    </div>
  );
}
