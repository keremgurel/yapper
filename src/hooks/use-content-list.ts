"use client";

import { useCallback, useEffect, useState } from "react";
import { listContent, type ContentSummary } from "@/lib/content/client";

/** The signed-in user's library rows. One concern: fetch + refresh + local
 * row patching (for optimistic status changes / removals). */
export function useContentList(enabled: boolean) {
  const [items, setItems] = useState<ContentSummary[] | null>(null);

  const refresh = useCallback(() => {
    listContent()
      .then(setItems)
      .catch(() => setItems([]));
  }, []);

  useEffect(() => {
    if (enabled) refresh();
  }, [enabled, refresh]);

  const patchRow = useCallback(
    (id: string, fields: Partial<ContentSummary>) => {
      setItems(
        (prev) =>
          prev?.map((row) => (row.id === id ? { ...row, ...fields } : row)) ??
          prev,
      );
    },
    [],
  );

  const removeRow = useCallback((id: string) => {
    setItems((prev) => prev?.filter((row) => row.id !== id) ?? prev);
  }, []);

  return { items, refresh, patchRow, removeRow };
}
