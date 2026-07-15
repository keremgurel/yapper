"use client";

import { useCallback, useEffect, useState } from "react";
import { trimBounds } from "@/lib/studio/clips";
import { nearest } from "@/lib/studio/snap";
import type { Clip } from "@/lib/studio/types";

/** Shortest a base clip may be trimmed to, in source seconds. */
const MIN_CLIP = 0.2;

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

interface TrimDrag {
  id: string;
  edge: "start" | "end";
  startX: number;
  origStart: number;
  origEnd: number;
}

export interface TrimDragState {
  /** The clip being trimmed, or null. */
  id: string | null;
  /** Which edge is under the cursor, or null when idle. */
  edge: "start" | "end" | null;
  /** The clip's range as it is being dragged, for optimistic rendering. */
  live: { start: number; end: number } | null;
  begin: (drag: TrimDrag) => void;
}

/**
 * Dragging a base clip's left or right edge to trim it. Unlike the move drags,
 * a trim commits exactly once, on pointerup, so it needs no per-move gesture id:
 * a single `onCommit` is already one undo step. `live` renders the clip at its
 * in-progress range until then.
 *
 * The finished range lives in a `current` closure variable as well as `live`
 * state, because pointerup must read the position the last pointermove computed,
 * not an unflushed setState. React flushes pending renders before a discrete
 * event, but reading `live` here would still risk the initial value, so the
 * closure var is the source of truth for the commit.
 */
export function useTrimDrag({
  clips,
  sourceDuration,
  pxPerSec,
  snapping,
  currentTimelineTime,
  onCommit,
}: {
  clips: Clip[];
  sourceDuration: number;
  pxPerSec: number;
  snapping: boolean;
  currentTimelineTime: number;
  onCommit: (id: string, start: number, end: number) => void;
}): TrimDragState {
  const [trim, setTrim] = useState<TrimDrag | null>(null);
  const [live, setLive] = useState<{ start: number; end: number } | null>(null);

  const begin = useCallback((drag: TrimDrag) => setTrim(drag), []);

  useEffect(() => {
    if (!trim) return;
    const idx = clips.findIndex((c) => c.id === trim.id);
    const clip = clips[idx];
    if (!clip) return;
    const { min: prevEnd, max: nextStart } = trimBounds(
      clips,
      idx,
      sourceDuration,
    );
    // Magnet targets (in source seconds): neighbor edges and the playhead.
    const offset = clips
      .slice(0, idx)
      .reduce((s, c) => s + (c.end - c.start), 0);
    const clipDur = clip.end - clip.start;
    const playheadInClip =
      currentTimelineTime >= offset && currentTimelineTime <= offset + clipDur;
    const playheadSource = clip.start + (currentTimelineTime - offset);
    const snapEdge = (t: number) => {
      if (!snapping) return t;
      const points = playheadInClip
        ? [prevEnd, nextStart, playheadSource]
        : [prevEnd, nextStart];
      // Nearest in-range magnet, matching the clip-move snap (was first-in-range,
      // which snapped to a clip bound over a closer playhead).
      return nearest(t, points, 8 / pxPerSec);
    };

    let current: { start: number; end: number } | null = null;
    const onMove = (e: PointerEvent) => {
      const deltaSec = (e.clientX - trim.startX) / pxPerSec;
      if (trim.edge === "start") {
        const start = clamp(
          snapEdge(trim.origStart + deltaSec),
          prevEnd,
          trim.origEnd - MIN_CLIP,
        );
        current = { start, end: trim.origEnd };
      } else {
        const end = clamp(
          snapEdge(trim.origEnd + deltaSec),
          trim.origStart + MIN_CLIP,
          nextStart,
        );
        current = { start: trim.origStart, end };
      }
      setLive(current);
    };
    const onUp = () => {
      if (current) onCommit(trim.id, current.start, current.end);
      setLive(null);
      setTrim(null);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [
    trim,
    clips,
    sourceDuration,
    pxPerSec,
    onCommit,
    snapping,
    currentTimelineTime,
  ]);

  return { id: trim?.id ?? null, edge: trim?.edge ?? null, live, begin };
}
