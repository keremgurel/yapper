"use client";

import { Image as ImageIcon, Video } from "lucide-react";
import ClipFilmstrip from "@/components/studio/clip-filmstrip";
import WaveformCanvas from "@/components/studio/waveform-canvas";
import type { Frame } from "@/hooks/use-filmstrip";
import { visibleSpan } from "@/lib/studio/window";
import type { Overlay } from "@/lib/studio/types";

/**
 * A clip on an upper video track. When it references the recording it shows the
 * real thumbnails + waveform for its source slice, so it reads as a real clip
 * (not a flat bar). Track controls live in the fixed header rail, not here.
 */
export default function UpperTrackLane({
  overlay,
  pxPerSec,
  visStartSec,
  visEndSec,
  frames,
  aspect,
  peaks,
  sourceUrl,
  sourceDuration,
  onDragStart,
}: {
  overlay: Overlay;
  pxPerSec: number;
  visStartSec: number;
  visEndSec: number;
  frames: Frame[];
  aspect: number;
  peaks: number[];
  sourceUrl: string;
  sourceDuration: number;
  onDragStart: (id: string, clientX: number, origStart: number) => void;
}) {
  const o = overlay;
  const left = o.start * pxPerSec;
  const width = Math.max(o.duration * pxPerSec, 8);
  const isRecording = o.url === sourceUrl && o.kind === "video";
  const span = isRecording
    ? visibleSpan(
        o.start,
        o.duration,
        o.sourceStart,
        o.sourceStart + o.duration,
        visStartSec,
        visEndSec,
        pxPerSec,
      )
    : null;

  return (
    <div className="relative h-12">
      <div
        style={{ left, width }}
        onPointerDown={(e) => {
          e.preventDefault();
          onDragStart(o.id, e.clientX, o.start);
        }}
        className={`absolute inset-y-0 cursor-grab overflow-hidden rounded-md bg-fuchsia-500/20 ring-1 ring-fuchsia-500/60 active:cursor-grabbing ${o.hidden ? "opacity-40" : ""}`}
      >
        <span className="absolute inset-0 bg-fuchsia-500/15" />
        {span && frames.length > 0 && (
          <ClipFilmstrip
            frames={frames}
            aspect={aspect}
            leftPx={span.leftPx}
            widthPx={span.widthPx}
            srcStart={span.srcA}
            srcEnd={span.srcB}
            height={48}
          />
        )}
        {span && peaks.length > 0 && (
          <span
            className="pointer-events-none absolute bottom-0 bg-black/50"
            style={{ left: span.leftPx, width: span.widthPx }}
          >
            <WaveformCanvas
              peaks={peaks}
              sourceDuration={sourceDuration}
              clipStart={span.srcA}
              clipEnd={span.srcB}
              width={span.widthPx}
              height={18}
            />
          </span>
        )}

        {/* Name label */}
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center gap-1.5 bg-gradient-to-b from-black/70 to-transparent px-2 py-1">
          {o.kind === "image" ? (
            <ImageIcon className="h-3.5 w-3.5 shrink-0 text-fuchsia-200" />
          ) : (
            <Video className="h-3.5 w-3.5 shrink-0 text-fuchsia-200" />
          )}
          <span className="min-w-0 flex-1 truncate text-[11px] font-bold text-white/90">
            {o.name}
          </span>
        </div>
      </div>
    </div>
  );
}
