"use client";

import { useCallback, useMemo, useState } from "react";
import type { ContentSummary } from "@/lib/content/client";
import {
  DEFAULT_CONTENT_SORT,
  defaultDirFor,
  sortContent,
  type ContentSort,
  type ContentSortKey,
} from "@/lib/content/sort";

/** Holds the library table's sort column + direction and applies it to the
 * rows. Clicking a heading toggles direction when that column is already
 * active, otherwise switches to it at its natural default direction. One
 * concern: sort state. The math lives in `sortContent`. */
export function useContentSort(rows: ContentSummary[] | null) {
  const [sort, setSort] = useState<ContentSort>(DEFAULT_CONTENT_SORT);

  const toggle = useCallback((key: ContentSortKey) => {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: defaultDirFor(key) },
    );
  }, []);

  const sorted = useMemo(
    () => (rows ? sortContent(rows, sort) : rows),
    [rows, sort],
  );

  return { sort, toggle, sorted };
}
