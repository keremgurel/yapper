"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Width (px) for a right-docked panel, draggable from its left edge.
 * The handle's onPointerDown starts a drag; width is measured from the right
 * edge of the window and clamped.
 */
export function useResizablePanel(initial = 380, min = 300, max = 1000) {
  const [width, setWidth] = useState(initial);
  const dragging = useRef(false);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    dragging.current = true;
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";
  }, []);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (!dragging.current) return;
      const next = window.innerWidth - e.clientX;
      setWidth(Math.max(min, Math.min(max, next)));
    };
    const onUp = () => {
      if (!dragging.current) return;
      dragging.current = false;
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [min, max]);

  return { width, onPointerDown };
}
