"use client";

import { useMemo, useState } from "react";
import type { ContentSummary } from "@/lib/content/client";

/**
 * Search + pillar filtering for the shared table.
 *
 * Search covers the title, the creator's own words, and the reference title,
 * because "that thing about the referral program" is as likely to be in the
 * note they dictated as in the title the AI gave it.
 */
export function useItemFilters(rows: ContentSummary[]) {
  const [query, setQuery] = useState("");
  const [pillar, setPillar] = useState<string | null>(null);

  const pillarOptions = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => r.pillar && set.add(r.pillar));
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (pillar && row.pillar !== pillar) return false;
      if (!needle) return true;
      return (
        row.title.toLowerCase().includes(needle) ||
        row.originalNote.toLowerCase().includes(needle) ||
        (row.sourceTitle?.toLowerCase().includes(needle) ?? false)
      );
    });
  }, [rows, query, pillar]);

  const resultLabel =
    query.trim() || pillar ? `${filtered.length} of ${rows.length}` : null;

  return {
    query,
    setQuery,
    pillar,
    setPillar,
    pillarOptions,
    filtered,
    resultLabel,
  };
}
