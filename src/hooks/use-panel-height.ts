"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * A pane whose height is dragged from its top edge, taking space from whatever
 * sits above it. Upward is taller, which is why the delta is inverted.
 */
export function usePanelHeight(
  initial: number,
  min = 280,
): {
  height: number;
  onResizeDown: (e: React.PointerEvent) => void;
} {
  const [height, setHeight] = useState(initial);
  const [resizing, setResizing] = useState(false);
  const dragRef = useRef<{ startY: number; startH: number } | null>(null);

  const onResizeDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      dragRef.current = { startY: e.clientY, startH: height };
      setResizing(true);
    },
    [height],
  );

  useEffect(() => {
    if (!resizing) return;
    const onMove = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const next = d.startH + (d.startY - e.clientY);
      setHeight(Math.max(min, Math.min(window.innerHeight * 0.75, next)));
    };
    const onUp = () => setResizing(false);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [resizing, min]);

  return { height, onResizeDown };
}
