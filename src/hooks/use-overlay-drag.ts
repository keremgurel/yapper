"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LIFT_THRESHOLD_PX } from "@/lib/studio/timeline-drag";
import { newGestureId, type Overlay } from "@/lib/studio/types";

interface DragStart {
  id: string;
  clientX: number;
  clientY: number;
  origStart: number;
  /** The overlay's length, read once. It cannot change while it is dragged. */
  duration: number;
  /** Minted at pointerdown, so the whole drag collapses into one undo step. */
  gesture: string;
}

export interface OverlayDragState {
  /** The overlay being dragged, or null. */
  id: string | null;
  /** How far it has moved vertically. Positive is down. */
  liftY: number;
  /** Dragged far enough down that letting go folds it into the bottom track. */
  dropping: boolean;
  begin: (
    id: string,
    clientX: number,
    clientY: number,
    origStart: number,
  ) => void;
}

/**
 * Dragging an overlay along its track: sideways to move it, or far enough down
 * to fold it into the bottom sequence. The mirror of `useClipDrag`, which lifts
 * a bottom-track clip up onto a track of its own.
 *
 * `onMove` fires on every pointermove and is undoable, so it takes a gesture id
 * minted once at pointerdown: one drag, one undo step.
 *
 * The vertical distance lives in a ref, not a closure variable. `onMove` hands
 * back a fresh overlays array on every pointermove, so anything this effect
 * depended on would re-create it mid-drag and reset a closure to zero. React
 * also flushes pending renders before a discrete event, so pointerup would read
 * that zero even when the whole gesture happened inside one task. A ref is the
 * only thing here that outlives the effect.
 */
export function useOverlayDrag({
  overlays,
  pxPerSec,
  snapStart,
  onMove,
  onDropToBase,
}: {
  overlays: Overlay[];
  pxPerSec: number;
  /** Magnetism, shared with the other lanes. */
  snapStart: (start: number, duration: number) => number;
  onMove: (id: string, start: number, gesture: string) => void;
  onDropToBase: (id: string) => void;
}): OverlayDragState {
  const [drag, setDrag] = useState<DragStart | null>(null);
  const [liftY, setLiftY] = useState(0);

  const strayRef = useRef(0);

  const begin = useCallback(
    (id: string, clientX: number, clientY: number, origStart: number) => {
      strayRef.current = 0;
      setDrag({
        id,
        clientX,
        clientY,
        origStart,
        duration: overlays.find((o) => o.id === id)?.duration ?? 0,
        gesture: newGestureId(),
      });
    },
    [overlays],
  );

  useEffect(() => {
    if (!drag) return;

    const onPointerMove = (e: PointerEvent) => {
      const delta = (e.clientX - drag.clientX) / pxPerSec;
      onMove(
        drag.id,
        snapStart(drag.origStart + delta, drag.duration),
        drag.gesture,
      );
      strayRef.current = e.clientY - drag.clientY;
      setLiftY(strayRef.current);
    };

    const onPointerUp = () => {
      if (strayRef.current > LIFT_THRESHOLD_PX) onDropToBase(drag.id);
      strayRef.current = 0;
      setLiftY(0);
      setDrag(null);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [drag, pxPerSec, snapStart, onMove, onDropToBase]);

  return {
    id: drag?.id ?? null,
    liftY,
    dropping: drag != null && liftY > LIFT_THRESHOLD_PX,
    begin,
  };
}
