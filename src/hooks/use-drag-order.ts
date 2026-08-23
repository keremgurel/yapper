"use client";

import { useCallback, useRef, useState } from "react";

/**
 * Reordering a list by dragging, on the browser's own drag events.
 *
 * No library. The whole behaviour is "remember what was picked up, move it when
 * it passes over something else, commit on drop", and a dependency for that
 * would be more code than the code.
 *
 * The keyboard path is deliberately not here. Drag is a shortcut; the row menu
 * keeps move up and move down, which is what actually makes this reorderable
 * without a mouse.
 */
export function useDragOrder(
  ids: string[],
  onCommit: (ids: string[]) => void,
): {
  dragging: string | null;
  order: string[];
  handleProps: (id: string) => React.HTMLAttributes<HTMLSpanElement>;
  rowProps: (id: string) => React.HTMLAttributes<HTMLDivElement>;
} {
  const [dragging, setDragging] = useState<string | null>(null);
  const [order, setOrder] = useState<string[] | null>(null);
  // The live order during a drag, so a pointer crossing three rows in one
  // frame gets three moves rather than three moves off the same stale array.
  // Seeded on pick-up and only ever touched from an event handler.
  const liveRef = useRef<string[]>(ids);

  const current = order ?? ids;

  const move = useCallback((from: string, to: string) => {
    if (from === to) return;
    const next = [...liveRef.current];
    const fromAt = next.indexOf(from);
    const toAt = next.indexOf(to);
    if (fromAt < 0 || toAt < 0) return;
    next.splice(toAt, 0, next.splice(fromAt, 1)[0]);
    liveRef.current = next;
    setOrder(next);
  }, []);

  const finish = useCallback(() => {
    const next = liveRef.current;
    setDragging(null);
    setOrder(null);
    if (next.join() !== ids.join()) onCommit(next);
  }, [ids, onCommit]);

  return {
    dragging,
    order: current,
    handleProps: (id) => ({
      draggable: true,
      onDragStart: (event) => {
        liveRef.current = ids;
        setDragging(id);
        event.dataTransfer.effectAllowed = "move";
        // Firefox will not start a drag without payload, even unused payload.
        event.dataTransfer.setData("text/plain", id);
      },
      onDragEnd: finish,
    }),
    rowProps: (id) => ({
      onDragOver: (event) => {
        if (!dragging) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        move(dragging, id);
      },
      onDrop: (event) => {
        event.preventDefault();
        finish();
      },
    }),
  };
}
