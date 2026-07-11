"use client";

import { useEffect, useRef, useState } from "react";
import { clampCrop, FULL_CROP } from "@/lib/studio/crop";
import {
  newGestureId,
  type Overlay,
  type OverlayRect,
} from "@/lib/studio/types";

type Corner = "tl" | "tr" | "bl" | "br";

const CORNERS: { id: Corner; className: string; cursor: string }[] = [
  { id: "tl", className: "top-0 left-0", cursor: "cursor-nwse-resize" },
  { id: "tr", className: "top-0 right-0", cursor: "cursor-nesw-resize" },
  { id: "bl", className: "bottom-0 left-0", cursor: "cursor-nesw-resize" },
  { id: "br", className: "right-0 bottom-0", cursor: "cursor-nwse-resize" },
];

const OFFSET: Record<Corner, string> = {
  tl: "translate(-50%, -50%)",
  tr: "translate(50%, -50%)",
  bl: "translate(-50%, 50%)",
  br: "translate(50%, 50%)",
};

/** Move one corner and leave the other three where they are. */
function resize(rect: OverlayRect, corner: Corner, dx: number, dy: number) {
  const right = rect.x + rect.w;
  const bottom = rect.y + rect.h;
  const left = corner === "tl" || corner === "bl" ? rect.x + dx : rect.x;
  const top = corner === "tl" || corner === "tr" ? rect.y + dy : rect.y;
  const r = corner === "tr" || corner === "br" ? right + dx : right;
  const b = corner === "bl" || corner === "br" ? bottom + dy : bottom;
  return { x: left, y: top, w: r - left, h: b - top };
}

/**
 * The crop popover: the whole media, with the kept rectangle bright and the
 * rest dimmed. Drag the rectangle to pan, its corners to resize. Every gesture
 * commits, so the preview behind updates as you go and one drag is one undo
 * step.
 */
export default function OverlayCropEditor({
  overlay,
  aspect,
  onChange,
  onClose,
}: {
  overlay: Overlay;
  /** The media's own width / height, so the editor shows it undistorted. */
  aspect: number;
  onChange: (crop: OverlayRect, gesture: string) => void;
  onClose: () => void;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    corner: Corner | null;
    startX: number;
    startY: number;
    rect: OverlayRect;
    gesture: string;
  } | null>(null);
  const [live, setLive] = useState<OverlayRect | null>(null);

  const crop = live ?? overlay.crop ?? FULL_CROP;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Enter") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const begin = (corner: Corner | null) => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = {
      corner,
      startX: e.clientX,
      startY: e.clientY,
      rect: crop,
      gesture: newGestureId(),
    };
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  };

  const move = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    const frame = frameRef.current;
    if (!drag || !frame) return;
    const box = frame.getBoundingClientRect();
    const dx = (e.clientX - drag.startX) / box.width;
    const dy = (e.clientY - drag.startY) / box.height;
    const next = clampCrop(
      drag.corner
        ? resize(drag.rect, drag.corner, dx, dy)
        : { ...drag.rect, x: drag.rect.x + dx, y: drag.rect.y + dy },
    );
    setLive(next);
    onChange(next, drag.gesture);
  };

  const end = () => {
    dragRef.current = null;
    setLive(null);
  };

  return (
    <div
      onPointerDown={(e) => e.stopPropagation()}
      className="border-border bg-card pointer-events-auto absolute top-3 left-3 z-40 w-64 rounded-lg border p-3 shadow-xl"
    >
      <p className="text-foreground/60 mb-2 text-[11px] font-bold">
        Crop {overlay.name}
      </p>

      <div
        ref={frameRef}
        style={{ aspectRatio: aspect }}
        className="relative w-full overflow-hidden rounded-md bg-black"
      >
        {overlay.kind === "image" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={overlay.url}
            alt=""
            draggable={false}
            className="pointer-events-none absolute inset-0 h-full w-full"
          />
        ) : (
          <video
            src={overlay.url}
            muted
            playsInline
            preload="metadata"
            className="pointer-events-none absolute inset-0 h-full w-full"
          />
        )}

        {/* Everything outside the kept rectangle, dimmed. */}
        <div className="pointer-events-none absolute inset-0 bg-black/60" />
        <div
          onPointerDown={begin(null)}
          onPointerMove={move}
          onPointerUp={end}
          style={{
            left: `${crop.x * 100}%`,
            top: `${crop.y * 100}%`,
            width: `${crop.w * 100}%`,
            height: `${crop.h * 100}%`,
          }}
          className="absolute cursor-move ring-2 ring-cyan-400"
        >
          <div className="absolute inset-0 overflow-hidden">
            {overlay.kind === "image" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={overlay.url}
                alt=""
                draggable={false}
                style={{
                  width: `${100 / crop.w}%`,
                  height: `${100 / crop.h}%`,
                  left: `${(-crop.x / crop.w) * 100}%`,
                  top: `${(-crop.y / crop.h) * 100}%`,
                }}
                className="pointer-events-none absolute max-w-none"
              />
            ) : (
              <video
                src={overlay.url}
                muted
                playsInline
                preload="metadata"
                style={{
                  width: `${100 / crop.w}%`,
                  height: `${100 / crop.h}%`,
                  left: `${(-crop.x / crop.w) * 100}%`,
                  top: `${(-crop.y / crop.h) * 100}%`,
                }}
                className="pointer-events-none absolute max-w-none"
              />
            )}
          </div>
          {CORNERS.map((c) => (
            <span
              key={c.id}
              onPointerDown={begin(c.id)}
              onPointerMove={move}
              onPointerUp={end}
              style={{ transform: OFFSET[c.id] }}
              className={`absolute z-10 h-3 w-3 rounded-full border-2 border-cyan-400 bg-white ${c.className} ${c.cursor}`}
            />
          ))}
        </div>
      </div>

      <div className="mt-2 flex justify-between gap-2">
        <button
          type="button"
          onClick={() => onChange(FULL_CROP, newGestureId())}
          className="text-foreground/60 hover:text-foreground text-[11px] font-bold"
        >
          Reset
        </button>
        <button
          type="button"
          onClick={onClose}
          className="bg-foreground/10 hover:bg-foreground/20 rounded px-2.5 py-1 text-[11px] font-bold"
        >
          Done
        </button>
      </div>
    </div>
  );
}
