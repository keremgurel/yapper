"use client";

import { useCallback, useEffect, useState } from "react";
import { LIFT_THRESHOLD_PX } from "@/lib/studio/timeline-drag";
import { newGestureId, type Overlay } from "@/lib/studio/types";

interface DragStart {
  id: string;
  clientX: number;
  clientY: number;
  origStart: number;
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
 * minted once at pointerdown: one drag, one undo step. The vertical distance is
 * tracked in a closure as well as state, because pointerup has to read how far
 * the overlay actually got, not a setState that has not flushed.
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

  const begin = useCallback(
    (id: string, clientX: number, clientY: number, origStart: number) =>
      setDrag({ id, clientX, clientY, origStart, gesture: newGestureId() }),
    [],
  );

  useEffect(() => {
    if (!drag) return;
    const duration = overlays.find((o) => o.id === drag.id)?.duration ?? 0;
    let liveLiftY = 0;

    const onPointerMove = (e: PointerEvent) => {
      const delta = (e.clientX - drag.clientX) / pxPerSec;
      onMove(
        drag.id,
        snapStart(drag.origStart + delta, duration),
        drag.gesture,
      );
      liveLiftY = e.clientY - drag.clientY;
      setLiftY(liveLiftY);
    };

    const onPointerUp = () => {
      if (liveLiftY > LIFT_THRESHOLD_PX) onDropToBase(drag.id);
      setLiftY(0);
      setDrag(null);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [drag, overlays, pxPerSec, snapStart, onMove, onDropToBase]);

  return {
    id: drag?.id ?? null,
    liftY,
    dropping: drag != null && liftY > LIFT_THRESHOLD_PX,
    begin,
  };
}
