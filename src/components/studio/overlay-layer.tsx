"use client";

import { useEffect, useRef, useState } from "react";
import { useStudio } from "@/components/studio/studio-context";
import type { Overlay, OverlayRect } from "@/lib/studio/types";

function clamp01(v: number, max = 1): number {
  return Math.max(0, Math.min(max, v));
}

const MIN = 0.1; // minimum overlay size (fraction of stage)

type Corner = "tl" | "tr" | "bl" | "br";

// Insets (not negative offsets) so handles are never clipped by the stage's
// overflow-hidden, even when an overlay fills the whole frame.
const CORNERS: { id: Corner; className: string; cursor: string }[] = [
  { id: "tl", className: "top-1 left-1", cursor: "cursor-nwse-resize" },
  { id: "tr", className: "top-1 right-1", cursor: "cursor-nesw-resize" },
  { id: "bl", className: "bottom-1 left-1", cursor: "cursor-nesw-resize" },
  { id: "br", className: "right-1 bottom-1", cursor: "cursor-nwse-resize" },
];

interface DragState {
  mode: "move" | "resize";
  corner?: Corner;
  startX: number;
  startY: number;
  rect: OverlayRect;
}

function OverlayBox({
  overlay,
  local,
  playing,
  selected,
  onSelect,
  layerRef,
  onCommit,
}: {
  overlay: Overlay;
  local: number;
  playing: boolean;
  selected: boolean;
  onSelect: () => void;
  layerRef: React.RefObject<HTMLDivElement | null>;
  onCommit: (rect: OverlayRect) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const [live, setLive] = useState<OverlayRect | null>(null);

  const base: OverlayRect = {
    x: overlay.x ?? 0,
    y: overlay.y ?? 0,
    w: overlay.w ?? 1,
    h: overlay.h ?? 1,
  };
  const r = live ?? base;

  const target = overlay.sourceStart + local;
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (Math.abs(v.currentTime - target) > 0.3) v.currentTime = target;
    if (playing) {
      if (v.paused) void v.play().catch(() => {});
    } else if (!v.paused) {
      v.pause();
    }
  }, [target, playing]);

  const start =
    (mode: "move" | "resize", corner?: Corner) => (e: React.PointerEvent) => {
      e.stopPropagation();
      e.preventDefault();
      onSelect();
      dragRef.current = {
        mode,
        corner,
        startX: e.clientX,
        startY: e.clientY,
        rect: base,
      };
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
    };

  const move = (e: React.PointerEvent) => {
    const d = dragRef.current;
    const box = layerRef.current?.getBoundingClientRect();
    if (!d || !box) return;
    const dx = (e.clientX - d.startX) / box.width;
    const dy = (e.clientY - d.startY) / box.height;
    if (d.mode === "move") {
      setLive({
        x: clamp01(d.rect.x + dx, 1 - d.rect.w),
        y: clamp01(d.rect.y + dy, 1 - d.rect.h),
        w: d.rect.w,
        h: d.rect.h,
      });
      return;
    }
    // Resize: grow/shrink from the dragged corner, keeping the opposite edge fixed.
    const { x, y, w, h } = d.rect;
    const c = d.corner ?? "br";
    let nx = x;
    let ny = y;
    let nw = w;
    let nh = h;
    if (c === "br" || c === "tr") {
      nw = Math.max(MIN, Math.min(1 - x, w + dx));
    } else {
      nw = Math.max(MIN, Math.min(x + w, w - dx));
      nx = x + w - nw;
    }
    if (c === "br" || c === "bl") {
      nh = Math.max(MIN, Math.min(1 - y, h + dy));
    } else {
      nh = Math.max(MIN, Math.min(y + h, h - dy));
      ny = y + h - nh;
    }
    setLive({ x: nx, y: ny, w: nw, h: nh });
  };

  const end = (e: React.PointerEvent) => {
    if (dragRef.current) {
      setLive((l) => {
        if (l) onCommit(l);
        return null;
      });
      dragRef.current = null;
      try {
        (e.currentTarget as Element).releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    }
  };

  return (
    <div
      onPointerDown={start("move")}
      onPointerMove={move}
      onPointerUp={end}
      style={{
        left: `${r.x * 100}%`,
        top: `${r.y * 100}%`,
        width: `${r.w * 100}%`,
        height: `${r.h * 100}%`,
      }}
      className={`pointer-events-auto absolute cursor-move overflow-hidden rounded-[2px] ${
        selected
          ? "ring-2 ring-cyan-400"
          : "ring-1 ring-white/20 hover:ring-white/60"
      }`}
    >
      {overlay.kind === "image" ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={overlay.url}
          alt=""
          draggable={false}
          className="pointer-events-none h-full w-full object-cover"
        />
      ) : (
        <video
          ref={videoRef}
          src={overlay.url}
          muted={overlay.muted ?? true}
          playsInline
          className="pointer-events-none h-full w-full object-cover"
        />
      )}
      {selected &&
        CORNERS.map((corner) => (
          <span
            key={corner.id}
            onPointerDown={start("resize", corner.id)}
            onPointerMove={move}
            onPointerUp={end}
            className={`absolute h-3.5 w-3.5 rounded-full border-2 border-cyan-400 bg-white shadow ${corner.className} ${corner.cursor}`}
          />
        ))}
    </div>
  );
}

/**
 * Composites upper video/image tracks over the base preview at the master clock.
 * Later overlays render on top (topmost track wins). Tap an overlay to select
 * it, then drag to move or use the corner handle to resize.
 */
export default function OverlayLayer({
  overlays,
  masterTime,
  playing,
}: {
  overlays: Overlay[];
  masterTime: number;
  playing: boolean;
}) {
  const { setOverlayRect } = useStudio();
  const layerRef = useRef<HTMLDivElement>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <div ref={layerRef} className="pointer-events-none absolute inset-0">
      {overlays.map((o) => {
        if (o.hidden) return null;
        const local = masterTime - o.start;
        if (local < 0 || local >= o.duration) return null;
        return (
          <OverlayBox
            key={o.id}
            overlay={o}
            local={local}
            playing={playing}
            selected={selectedId === o.id}
            onSelect={() => setSelectedId(o.id)}
            layerRef={layerRef}
            onCommit={(rect) => setOverlayRect(o.id, rect)}
          />
        );
      })}
    </div>
  );
}
