"use client";

import { useCallback, useEffect, useState } from "react";

/** Whether the document has the whole width, with the chat pane put away.
 * Escape brings the chat back. */
export function useCanvasMaximized() {
  const [maximized, setMaximized] = useState(false);
  const toggle = useCallback(() => setMaximized((value) => !value), []);
  useEffect(() => {
    if (!maximized) return;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setMaximized(false);
    };
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [maximized]);
  return { maximized, toggle };
}
