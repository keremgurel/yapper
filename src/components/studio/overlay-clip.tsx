"use client";

import { useEffect, useState } from "react";
import { Image as ImageIcon, Video } from "lucide-react";
import ClipFilmstrip from "@/components/studio/clip-filmstrip";
import WaveformCanvas from "@/components/studio/waveform-canvas";
import type { Filmstrip } from "@/lib/studio/filmstrip";
import { visibleSpan } from "@/lib/studio/window";
import { newGestureId, type Overlay } from "@/lib/studio/types";

const MIN = 0.1; // minimum overlay duration (seconds)

/** What letting go right now would do to this clip, for the drag's ring color. */
export type DropHint = "none" | "track" | "base" | "blocked";

interface TrimState {
  edge: "start" | "end";
  startX: number;
  orig: { start: number; duration: number; sourceStart: number };
  /** Minted at pointerdown so the whole trim collapses into one undo step. */
  gesture: string;
}

/**
 * One clip on an upper video track. It shows the real thumbnails + waveform for
 * its own media's slice — whether that's the recording or an uploaded asset —
 * so it reads as a real clip, not a flat bar. Its lane places it vertically;
 * track controls live in the fixed header rail.
 */
export default function OverlayClip({
  overlay,
  pxPerSec,
  visStartSec,
  visEndSec,
  strip,
  peaks,
  mediaDuration,
  fullDuration,
  bounds,
  selected,
  liftY,
  dropHint,
  onSelect,
  onDragStart,
  onTrim,
}: {
  overlay: Overlay;
  pxPerSec: number;
  visStartSec: number;
  visEndSec: number;
  /** Thumbnails for this overlay's own media. */
  strip: Filmstrip;
  /** Waveform peaks for this overlay's own media. */
  peaks: number[];
  /** Length of that media, which the waveform is drawn against. */
  mediaDuration: number;
  fullDuration: number;
  /** How far the edges can be dragged out before they meet the neighbours. */
  bounds: { min: number; max: number };
  selected: boolean;
  /** How far the drag has pulled it off its lane. 0 when it is at rest. */
  liftY: number;
  dropHint: DropHint;
  onSelect: (additive: boolean) => void;
  onDragStart: (
    id: string,
    clientX: number,
    clientY: number,
    origStart: number,
  ) => void;
  onTrim: (
    id: string,
    start: number,
    duration: number,
    sourceStart: number,
    gesture: string,
  ) => void;
}) {
  const o = overlay;
  const [trim, setTrim] = useState<TrimState | null>(null);
  const isImg = o.kind === "image";

  useEffect(() => {
    if (!trim) return;
    const onMove = (e: PointerEvent) => {
      const delta = (e.clientX - trim.startX) / pxPerSec;
      const g = trim.orig;
      if (trim.edge === "start") {
        // Left edge: shift start + in-point, keep the right edge fixed.
        let d = delta;
        d = Math.min(d, g.duration - MIN); // keep >= MIN
        d = Math.max(d, bounds.min - g.start); // don't cross 0:00 or a neighbour
        if (!isImg) d = Math.max(d, -g.sourceStart); // don't cross media in-point
        onTrim(
          o.id,
          g.start + d,
          g.duration - d,
          isImg ? g.sourceStart : g.sourceStart + d,
          trim.gesture,
        );
      } else {
        // Right edge: change duration only.
        let d = delta;
        d = Math.max(d, MIN - g.duration);
        if (Number.isFinite(fullDuration)) {
          d = Math.min(d, fullDuration - (g.sourceStart + g.duration));
        }
        if (Number.isFinite(bounds.max)) {
          d = Math.min(d, bounds.max - (g.start + g.duration));
        }
        onTrim(o.id, g.start, g.duration + d, g.sourceStart, trim.gesture);
      }
    };
    const onUp = () => setTrim(null);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [trim, pxPerSec, fullDuration, bounds, isImg, o.id, onTrim]);

  const beginTrim = (edge: "start" | "end") => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setTrim({
      edge,
      startX: e.clientX,
      orig: {
        start: o.start,
        duration: o.duration,
        sourceStart: o.sourceStart,
      },
      gesture: newGestureId(),
    });
  };

  const left = o.start * pxPerSec;
  const width = Math.max(o.duration * pxPerSec, 8);
  const span = isImg
    ? null
    : visibleSpan(
        o.start,
        o.duration,
        o.sourceStart,
        o.sourceStart + o.duration,
        visStartSec,
        visEndSec,
        pxPerSec,
      );

  return (
    <div
      style={{
        left,
        width,
        transform: liftY ? `translateY(${liftY}px)` : undefined,
      }}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();
        const additive = e.metaKey || e.ctrlKey;
        onSelect(additive);
        // ⌘/Ctrl-click toggles selection without starting a drag.
        if (additive) return;
        onDragStart(o.id, e.clientX, e.clientY, o.start);
      }}
      className={`group absolute inset-y-0 cursor-grab overflow-hidden rounded-md bg-violet-500/15 active:cursor-grabbing ${
        dropHint === "base"
          ? "z-30 opacity-90 ring-2 ring-fuchsia-400"
          : dropHint === "track"
            ? "z-30 opacity-90 ring-2 ring-emerald-300"
            : dropHint === "blocked"
              ? "z-30 opacity-90 ring-2 ring-rose-400"
              : liftY
                ? "z-30 opacity-90 ring-2 ring-violet-300"
                : selected
                  ? "z-10 ring-2 ring-cyan-400"
                  : "ring-1 ring-violet-400/40"
      } ${o.hidden ? "opacity-40" : ""}`}
    >
      <span className="absolute inset-0 bg-violet-500/10" />
      {isImg && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={o.url}
          alt=""
          draggable={false}
          className="pointer-events-none absolute inset-0 h-full w-full object-cover"
        />
      )}
      {span && strip.frames.length > 0 && (
        <ClipFilmstrip
          frames={strip.frames}
          aspect={strip.aspect}
          leftPx={span.leftPx}
          widthPx={span.widthPx}
          srcStart={span.srcA}
          srcEnd={span.srcB}
          height={48}
        />
      )}
      {span && peaks.length > 0 && mediaDuration > 0 && (
        <span
          className="pointer-events-none absolute bottom-0 bg-black/50"
          style={{ left: span.leftPx, width: span.widthPx }}
        >
          <WaveformCanvas
            peaks={peaks}
            sourceDuration={mediaDuration}
            clipStart={span.srcA}
            clipEnd={span.srcB}
            width={span.widthPx}
            height={18}
          />
        </span>
      )}

      {/* Name label */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center gap-1.5 bg-gradient-to-b from-black/70 to-transparent px-2 py-1">
        {isImg ? (
          <ImageIcon className="h-3.5 w-3.5 shrink-0 text-violet-200" />
        ) : (
          <Video className="h-3.5 w-3.5 shrink-0 text-violet-200" />
        )}
        <span className="min-w-0 flex-1 truncate text-[11px] font-bold text-white/90">
          {o.name}
        </span>
      </div>

      {/* Trim edges — drag to change the clip's in/out, just like the base. */}
      <span
        onPointerDown={beginTrim("start")}
        className="absolute inset-y-0 left-0 z-10 w-2 cursor-ew-resize bg-violet-300/70 opacity-0 transition-opacity group-hover:opacity-100"
      />
      <span
        onPointerDown={beginTrim("end")}
        className="absolute inset-y-0 right-0 z-10 w-2 cursor-ew-resize bg-violet-300/70 opacity-0 transition-opacity group-hover:opacity-100"
      />
    </div>
  );
}
