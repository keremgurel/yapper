"use client";

import { useEffect, useRef, useState } from "react";
import { useStudio } from "@/components/studio/studio-context";
import { captionTimelineRange, caseTransform } from "@/lib/studio/captions";

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

interface Drag {
  id: string;
  mode: "move" | "resize";
  startX: number;
  startY: number;
  x: number;
  y: number;
  w: number;
}

/**
 * Renders every caption layer under the playhead. Spoken captions normally
 * occupy one slot; text hooks can overlap them and are intentionally drawn too.
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

  const active = captions.filter((c) => {
    const r = captionTimelineRange(clips, c);
    return r.end > r.start && masterTime >= r.start && masterTime < r.end;
  });

  const start =
    (
      id: string,
      mode: "move" | "resize",
      layout: { x: number; y: number; w: number },
    ) =>
    (e: React.PointerEvent) => {
      e.stopPropagation();
      e.preventDefault();
      selectCaption(id);
      dragRef.current = {
        id,
        mode,
        startX: e.clientX,
        startY: e.clientY,
        ...layout,
      };
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
    };
  const move = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d || !box.w || !box.h) return;
    if (d.mode === "move") {
      updateCaptionLayout(d.id, {
        x: clamp(d.x + (e.clientX - d.startX) / box.w, 0.05, 0.95),
        y: clamp(d.y + (e.clientY - d.startY) / box.h, 0.05, 0.95),
      });
    } else {
      // Resize the box width (centered); font size stays put.
      updateCaptionLayout(d.id, {
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
      {active.map((caption) => {
        const hook = caption.kind === "hook";
        const x = caption.x ?? (hook ? 0.5 : captionStyle.x);
        const y = caption.y ?? (hook ? 0.16 : captionStyle.y);
        const w = caption.w ?? (hook ? 0.82 : captionStyle.width);
        const scale = caption.scale ?? (hook ? 0.056 : captionStyle.fontScale);
        const fontFamily = caption.fontFamily ?? captionStyle.fontFamily;
        const textCase = caption.textCase ?? captionStyle.textCase;
        const selected = selectedCaptionId === caption.id;
        const fontSize = box.h ? scale * box.h : 20;
        const widthPx = box.w ? w * box.w : undefined;
        const card = hook && caption.hookPreset !== "white-text";
        const whiteCard = hook && caption.hookPreset === "white-card";
        return (
          <div
            key={caption.id}
            onPointerDown={start(caption.id, "move", { x, y, w })}
            onPointerMove={move}
            onPointerUp={end}
            style={{
              left: `${x * 100}%`,
              top: `${y * 100}%`,
              width: widthPx,
              transform: "translate(-50%, -50%)",
              fontFamily,
              fontSize,
              textTransform: caseTransform(textCase),
              textShadow: card
                ? "none"
                : "0 2px 10px rgba(0,0,0,0.7), 0 0 2px rgba(0,0,0,0.9)",
            }}
            className={`pointer-events-auto absolute cursor-move text-center font-black whitespace-pre-wrap ${
              card ? "rounded-[0.55em] px-[0.72em] py-[0.5em] shadow-xl" : ""
            } ${
              whiteCard
                ? "bg-white text-black"
                : card
                  ? "bg-black text-white ring-1 ring-white/15"
                  : "text-white"
            } ${selected ? "ring-2 ring-cyan-400" : ""}`}
          >
            {caption.text}
            {selected && (
              <span
                onPointerDown={start(caption.id, "resize", { x, y, w })}
                onPointerMove={move}
                onPointerUp={end}
                className="absolute top-1/2 -right-1.5 h-6 w-3 -translate-y-1/2 cursor-ew-resize rounded-full bg-cyan-400"
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
