"use client";

import { useCallback, useRef, useState } from "react";
import {
  clampToViewport,
  initialAnchor,
  readStoredAnchor,
  storeAnchor,
  type ChirpyPoint,
  type ChirpySize,
} from "@/components/studio-shell/chirpy-dock/chirpy-anchor";

/** Movement under this is a click with a shaky hand, not a drag. */
const DRAG_THRESHOLD = 4;

/**
 * Lets the creator pick the bird up and put it anywhere, like the Mac app.
 *
 * The bird tracks the pointer 1:1 with no transition, is clamped inside the
 * window, and remembers where it was dropped. A press that moved is a drag,
 * so the click that follows it is swallowed instead of opening the panel.
 */
export function useChirpyDrag(size: ChirpySize, bounds: ChirpySize | null) {
  const [placed, setPlaced] = useState<ChirpyPoint | null>(null);
  const [dragging, setDragging] = useState(false);
  const start = useRef<{ pointer: ChirpyPoint; anchor: ChirpyPoint } | null>(
    null,
  );
  const moved = useRef(false);

  // Clamped on every render, so a resized window pulls it back inside.
  const anchor = bounds
    ? clampToViewport(
        placed ?? readStoredAnchor() ?? initialAnchor(size, bounds),
        size,
        bounds,
      )
    : null;

  const onPointerDown = (event: React.PointerEvent<HTMLElement>) => {
    if (event.button !== 0 || !anchor) return;
    moved.current = false;
    start.current = {
      pointer: { x: event.clientX, y: event.clientY },
      anchor,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLElement>) => {
    const from = start.current;
    if (!from || !bounds) return;
    const dx = event.clientX - from.pointer.x;
    const dy = event.clientY - from.pointer.y;
    if (!moved.current && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    moved.current = true;
    setDragging(true);
    setPlaced(
      clampToViewport(
        { x: from.anchor.x + dx, y: from.anchor.y + dy },
        size,
        bounds,
      ),
    );
  };

  const end = (event: React.PointerEvent<HTMLElement>) => {
    if (!start.current) return;
    start.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    setDragging(false);
    if (moved.current && anchor) storeAnchor(anchor);
  };

  /** True once if the press that produced this click was a drag. */
  const wasDrag = useCallback(() => {
    const dragged = moved.current;
    moved.current = false;
    return dragged;
  }, []);

  return {
    anchor,
    dragging,
    wasDrag,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: end,
      onPointerCancel: end,
    },
  };
}
