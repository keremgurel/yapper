"use client";

import { useEffect, useRef, useState } from "react";
import { useStudio } from "@/components/studio/studio-context";
import { captionTimelineRange, caseTransform } from "@/lib/studio/captions";

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

interface Drag {
  mode: "move" | "resize";
  startX: number;
  startY: number;
  x: number;
  y: number;
  w: number;
}

/**
 * Renders the caption under the playhead over the video. Tap to select, drag to
 * move, drag the corner to resize. Whether a change applies to every caption or
 * just this one is governed by the Apply-to-all toggle (handled in context).
 */
export default function CaptionLayer({ masterTime }: { masterTime: number }) {
  const {
    clips,
    captions,
    captionStyle,
    selectedCaptionId,
    selectCaption,
    updateCaptionLayout,
  } = useStudio();
  const layerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<Drag | null>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = layerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() =>
      setBox({ w: el.clientWidth, h: el.clientHeight }),
    );
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const active = captions.find((c) => {
    const r = captionTimelineRange(clips, c);
    return r.end > r.start && masterTime >= r.start && masterTime < r.end;
  });
  if (!active) return <div ref={layerRef} className="absolute inset-0" />;

  const x = active.x ?? captionStyle.x;
  const y = active.y ?? captionStyle.y;
  const w = active.w ?? captionStyle.width;
  const scale = active.scale ?? captionStyle.fontScale;
  const selected = selectedCaptionId === active.id;
  const fontSize = box.h ? scale * box.h : 20;
  const widthPx = box.w ? w * box.w : undefined;

  const start = (mode: "move" | "resize") => (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    selectCaption(active.id);
    dragRef.current = {
      mode,
      startX: e.clientX,
      startY: e.clientY,
      x,
      y,
      w,
    };
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  };
  const move = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d || !box.w || !box.h) return;
    if (d.mode === "move") {
      updateCaptionLayout(active.id, {
        x: clamp(d.x + (e.clientX - d.startX) / box.w, 0.05, 0.95),
        y: clamp(d.y + (e.clientY - d.startY) / box.h, 0.05, 0.95),
      });
    } else {
      // Resize the box width (centered); font size stays put.
      updateCaptionLayout(active.id, {
        w: clamp(d.w + (2 * (e.clientX - d.startX)) / box.w, 0.2, 1),
      });
    }
  };
  const end = (e: React.PointerEvent) => {
    dragRef.current = null;
    try {
      (e.currentTarget as Element).releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  return (
    <div ref={layerRef} className="pointer-events-none absolute inset-0">
      <div
        onPointerDown={start("move")}
        onPointerMove={move}
        onPointerUp={end}
        style={{
          left: `${x * 100}%`,
          top: `${y * 100}%`,
          width: widthPx,
          transform: "translate(-50%, -50%)",
          fontFamily: captionStyle.fontFamily,
          fontSize,
          textTransform: caseTransform(captionStyle.textCase),
          textShadow: "0 2px 10px rgba(0,0,0,0.7), 0 0 2px rgba(0,0,0,0.9)",
        }}
        className={`pointer-events-auto absolute cursor-move text-center font-black whitespace-pre-wrap text-white ${
          selected ? "rounded ring-2 ring-cyan-400" : ""
        }`}
      >
        {active.text}
        {selected && (
          <span
            onPointerDown={start("resize")}
            onPointerMove={move}
            onPointerUp={end}
            className="absolute top-1/2 -right-1.5 h-6 w-3 -translate-y-1/2 cursor-ew-resize rounded-full bg-cyan-400"
          />
        )}
      </div>
    </div>
  );
}
