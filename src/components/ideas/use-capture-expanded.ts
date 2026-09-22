"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Whether the composer fills the window as a plain writing surface. Escape
 * brings it back, unless a take is being recorded, when Escape already means
 * "cancel the take". The page behind stops scrolling while it is up.
 */
export function useCaptureExpanded(hold: boolean) {
  const [expanded, setExpanded] = useState(false);
  const toggle = useCallback(() => setExpanded((current) => !current), []);

  useEffect(() => {
    if (!expanded) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [expanded]);

  useEffect(() => {
    if (!expanded || hold) return;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setExpanded(false);
    };
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [expanded, hold]);

  return { expanded, toggle };
}
