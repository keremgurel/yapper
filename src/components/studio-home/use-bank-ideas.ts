"use client";

import { useEffect, useState } from "react";
import { listIdeas, type ItemSummary } from "@/lib/ideas/client";

/** Idea Bank inbox rows for the daily suggestions. A fetch error degrades to
 * an empty list so Home falls back to its evergreen starters. */
export function useBankIdeas(enabled: boolean): ItemSummary[] {
  const [ideas, setIdeas] = useState<ItemSummary[]>([]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    listIdeas().then(
      (rows) => {
        if (!cancelled) setIdeas(rows);
      },
      () => {
        // Starters cover the gap; no error surface needed here.
      },
    );
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return ideas;
}
