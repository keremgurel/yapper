"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { newGestureId, type Overlay } from "@/lib/studio/types";

/** Where letting go of a dragged overlay would put it. */
export type OverlayDropTarget =
  | { kind: "base" }
  | { kind: "track"; track: number };

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
  /** Where it would land right now, or null to leave it where it is. */
  target: OverlayDropTarget | null;
  begin: (
    id: string,
    clientX: number,
    clientY: number,
    origStart: number,
  ) => void;
}

/**
 * Dragging an overlay: sideways to move it along its track, or vertically onto
 * another track, a new track above them all, or the base sequence below. The
 * mirror of `useClipDrag`, which lifts a base clip up onto a track of its own.
 *
 * `onMove` fires on every pointermove and is undoable, so it takes a gesture id
 * minted once at pointerdown: one drag, one undo step. `onDrop` gets the same
 * id, so the track change lands in that step too.
 *
 * The live target lives in a ref, not a closure variable. `onMove` hands back a
 * fresh overlays array on every pointermove, so anything this effect depended
 * on would re-create it mid-drag and reset a closure to its initial value.
 * React also flushes pending renders before a discrete event, so pointerup
 * would read that initial value even when the whole gesture happened inside one
 * task. A ref is the only thing here that outlives the effect.
 */
export function useOverlayDrag({
  overlays,
  pxPerSec,
  snapStart,
  resolveTarget,
  onMove,
  onDrop,
}: {
  overlays: Overlay[];
  pxPerSec: number;
  /** Magnetism, shared with the other lanes. */
  snapStart: (start: number, duration: number) => number;
  /** Which lane a screen y sits over. Must not change identity mid-drag. */
  resolveTarget: (clientY: number) => OverlayDropTarget | null;
  onMove: (id: string, start: number, gesture: string) => void;
  onDrop: (id: string, target: OverlayDropTarget, gesture: string) => void;
}): OverlayDragState {
  const [drag, setDrag] = useState<DragStart | null>(null);
  const [liftY, setLiftY] = useState(0);
  const [target, setTarget] = useState<OverlayDropTarget | null>(null);

  const targetRef = useRef<OverlayDropTarget | null>(null);

  const begin = useCallback(
    (id: string, clientX: number, clientY: number, origStart: number) => {
      targetRef.current = null;
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
      targetRef.current = resolveTarget(e.clientY);
      setTarget(targetRef.current);
      setLiftY(e.clientY - drag.clientY);
    };

    const onPointerUp = () => {
      const landed = targetRef.current;
      if (landed) onDrop(drag.id, landed, drag.gesture);
      targetRef.current = null;
      setTarget(null);
      setLiftY(0);
      setDrag(null);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [drag, pxPerSec, snapStart, resolveTarget, onMove, onDrop]);

  return { id: drag?.id ?? null, liftY, target, begin };
}
