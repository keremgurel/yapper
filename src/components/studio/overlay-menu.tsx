"use client";

import { useEffect, useRef } from "react";
import { Crop, Maximize, Minimize, RotateCcw } from "lucide-react";

/** Where the menu opened, in stage fractions, so it follows the stage's size. */
export interface MenuAnchor {
  id: string;
  x: number;
  y: number;
}

const ITEM =
  "flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs font-medium text-foreground/80 hover:bg-foreground/10 disabled:opacity-40 disabled:hover:bg-transparent";

/**
 * The right-click menu on an overlay: what to do with the picture inside its
 * box. Everything here is about the media, not the clip, which is why it lives
 * on the preview rather than on the timeline.
 */
export default function OverlayMenu({
  anchor,
  cropped,
  onCrop,
  onFit,
  onFill,
  onResetCrop,
  onClose,
}: {
  anchor: MenuAnchor;
  /** Whether the overlay currently hides part of its media. */
  cropped: boolean;
  onCrop: () => void;
  onFit: () => void;
  onFill: () => void;
  onResetCrop: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    // Capture, so a press meant to dismiss the menu doesn't also land on the
    // overlay underneath. A press on the menu itself has to survive it, or the
    // menu would unmount before its item's click ever fired.
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown, { capture: true });
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown, { capture: true });
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      style={{ left: `${anchor.x * 100}%`, top: `${anchor.y * 100}%` }}
      onPointerDown={(e) => e.stopPropagation()}
      className="border-border bg-card pointer-events-auto absolute z-40 w-40 overflow-hidden rounded-md border py-1 shadow-lg"
    >
      <button type="button" className={ITEM} onClick={onCrop}>
        <Crop className="h-3.5 w-3.5 shrink-0" />
        Crop
      </button>
      <button type="button" className={ITEM} onClick={onFit}>
        <Minimize className="h-3.5 w-3.5 shrink-0" />
        Fit to frame
      </button>
      <button type="button" className={ITEM} onClick={onFill}>
        <Maximize className="h-3.5 w-3.5 shrink-0" />
        Fill frame
      </button>
      <button
        type="button"
        className={ITEM}
        disabled={!cropped}
        onClick={onResetCrop}
      >
        <RotateCcw className="h-3.5 w-3.5 shrink-0" />
        Reset crop
      </button>
    </div>
  );
}
