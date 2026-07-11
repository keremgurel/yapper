"use client";

import { useLayoutEffect } from "react";

/**
 * Grow a textarea to fit what has been typed, up to `maxPx`, then let it
 * scroll. The height is reset to `auto` first, or shrinking back down after a
 * deletion would be impossible: `scrollHeight` never reports less than the
 * height already set.
 */
export function useAutosizeTextarea(
  ref: React.RefObject<HTMLTextAreaElement | null>,
  value: string,
  maxPx = 160,
): void {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, maxPx)}px`;
  }, [ref, value, maxPx]);
}
