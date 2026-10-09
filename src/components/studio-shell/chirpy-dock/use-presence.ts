"use client";

import { useEffect, useState } from "react";

/**
 * Keeps something mounted for its exit animation. `shown` follows `open`
 * straight away when opening; when closing it stays true for `exitMs` while
 * `leaving` is true, then drops.
 */
export function usePresence(open: boolean, exitMs: number) {
  const [shown, setShown] = useState(open);
  if (open && !shown) setShown(true);

  useEffect(() => {
    if (open || !shown) return;
    const timer = window.setTimeout(() => setShown(false), exitMs);
    return () => window.clearTimeout(timer);
  }, [open, shown, exitMs]);

  return { shown, leaving: shown && !open };
}
