"use client";

import { useEffect, useState } from "react";
import { listContent, type ContentSummary } from "@/lib/content/client";

/** Content Library (pipeline) rows. `null` while loading; an error settles to
 * an empty list rather than a skeleton that never resolves. */
export function usePipelineItems(enabled: boolean): ContentSummary[] | null {
  const [items, setItems] = useState<ContentSummary[] | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    listContent().then(
      (rows) => {
        if (!cancelled) setItems(rows);
      },
      () => {
        if (!cancelled) setItems([]);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return items;
}
