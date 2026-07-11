"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { clipDuration } from "@/lib/studio/clips";
import {
  DRAG_JITTER_PX,
  LIFT_THRESHOLD_PX,
  dropIndexAt,
} from "@/lib/studio/timeline-drag";
import type { Clip } from "@/lib/studio/types";

interface DragStart {
  id: string;
  clientX: number;
  clientY: number;
  /** The clip's resting left edge, in content-div px. */
  origLeft: number;
}

export interface ClipDragState {
  /** The clip under the pointer, or null when nothing is being dragged. */
  id: string | null;
  /** Its dragged left edge in px, or null until the pointer really moves. */
  left: number | null;
  /** How far it has moved vertically. Negative is up. */
  liftY: number;
  /** Dragged far enough up to leave the bottom track for one of its own. */
  lifting: boolean;
  begin: (
    id: string,
    clientX: number,
    clientY: number,
    origLeft: number,
  ) => void;
}

/**
 * Dragging a clip along the bottom track: sideways to reorder it, or far enough
 * up to lift it onto a new upper video track.
 *
 * The live position lives in refs as well as state. The state drives the render;
 * the refs are what `pointerup` reads, so the drop sees where the clip actually
 * finished rather than a state update that has not flushed yet.
 *
 * Refs and not closure variables: anything this effect depends on could change
 * mid-drag and re-create it, resetting a closure to its initial value. The
 * overlay drag lost its drop that way.
 */
export function useClipDrag({
  clips,
  pxPerSec,
  onReorder,
  onLift,
}: {
  clips: Clip[];
  pxPerSec: number;
  onReorder: (id: string, toIndex: number) => void;
  /** `timelineStart` is where the lifted clip should land, in seconds. */
  onLift: (id: string, timelineStart: number) => void;
}): ClipDragState {
  const [drag, setDrag] = useState<DragStart | null>(null);
  const [left, setLeft] = useState<number | null>(null);
  const [liftY, setLiftY] = useState(0);
  const leftRef = useRef<number | null>(null);
  const liftYRef = useRef(0);

  const begin = useCallback(
    (id: string, clientX: number, clientY: number, origLeft: number) => {
      leftRef.current = null;
      liftYRef.current = 0;
      setDrag({ id, clientX, clientY, origLeft });
    },
    [],
  );

  useEffect(() => {
    if (!drag) return;
    const dragged = clips.find((c) => c.id === drag.id);
    const seconds = dragged ? clipDuration(dragged) : 0;

    const onMove = (e: PointerEvent) => {
      const dx = e.clientX - drag.clientX;
      const dy = e.clientY - drag.clientY;
      // A press that has not travelled yet is a click, not a drag.
      if (leftRef.current == null && Math.hypot(dx, dy) < DRAG_JITTER_PX)
        return;
      leftRef.current = drag.origLeft + dx;
      liftYRef.current = dy;
      setLeft(leftRef.current);
      setLiftY(dy);
    };

    const onUp = () => {
      const finalLeft = leftRef.current;
      if (finalLeft != null) {
        if (liftYRef.current < -LIFT_THRESHOLD_PX) {
          onLift(drag.id, Math.max(0, finalLeft / pxPerSec));
        } else {
          const center = finalLeft / pxPerSec + seconds / 2;
          onReorder(drag.id, dropIndexAt(clips, drag.id, center));
        }
      }
      leftRef.current = null;
      liftYRef.current = 0;
      setLeft(null);
      setLiftY(0);
      setDrag(null);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [drag, clips, pxPerSec, onReorder, onLift]);

  return {
    id: drag?.id ?? null,
    left,
    liftY,
    lifting: left != null && liftY < -LIFT_THRESHOLD_PX,
    begin,
  };
}
