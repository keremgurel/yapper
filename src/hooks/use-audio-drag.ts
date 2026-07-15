"use client";

import { useCallback, useEffect, useState } from "react";
import { newGestureId, type AudioTrack } from "@/lib/studio/types";

interface AudioDragStart {
  id: string;
  clientX: number;
  origStart: number;
  /** The clip's length, read once. It cannot change while it is dragged. */
  duration: number;
  /** Minted at pointerdown, so the whole drag collapses into one undo step. */
  gesture: string;
}

export interface AudioDragState {
  /** The audio clip being dragged, or null. */
  id: string | null;
  begin: (id: string, clientX: number, origStart: number) => void;
}

/**
 * Dragging an audio clip sideways along its lane. The horizontal-only sibling of
 * `useOverlayDrag`: no vertical gesture, so no track to change and nothing to
 * drop, which is why it needs neither a drop target nor a ref to read one on
 * pointerup. `onMove` already fired on the last pointermove.
 *
 * `duration` is read once at pointerdown and carried in the drag, not looked up
 * from `audioTracks` inside the effect. `onMove` replaces that array on every
 * move, so depending on it here would re-create the effect (and re-attach the
 * window listeners) mid-drag.
 */
export function useAudioDrag({
  audioTracks,
  pxPerSec,
  snapStart,
  onMove,
}: {
  audioTracks: AudioTrack[];
  pxPerSec: number;
  /** Magnetism, shared with the other lanes. `excludeId` skips self-snapping. */
  snapStart: (start: number, duration: number, excludeId?: string) => number;
  onMove: (id: string, start: number, gesture: string) => void;
}): AudioDragState {
  const [drag, setDrag] = useState<AudioDragStart | null>(null);

  const begin = useCallback(
    (id: string, clientX: number, origStart: number) => {
      setDrag({
        id,
        clientX,
        origStart,
        duration: audioTracks.find((t) => t.id === id)?.duration ?? 0,
        gesture: newGestureId(),
      });
    },
    [audioTracks],
  );

  useEffect(() => {
    if (!drag) return;
    const onPointerMove = (e: PointerEvent) => {
      const delta = (e.clientX - drag.clientX) / pxPerSec;
      onMove(
        drag.id,
        snapStart(drag.origStart + delta, drag.duration, drag.id),
        drag.gesture,
      );
    };
    const onPointerUp = () => setDrag(null);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [drag, pxPerSec, snapStart, onMove]);

  return { id: drag?.id ?? null, begin };
}
