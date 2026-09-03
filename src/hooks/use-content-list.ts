"use client";

import { useCallback, useState } from "react";
import { listContent, type ContentSummary } from "@/lib/content/client";
import { STUDIO_RESOURCE_KEYS } from "@/lib/client-resource-cache";
import { useClientResource } from "@/hooks/use-client-resource";

/** The signed-in user's library rows. One concern: fetch + refresh + local
 * row patching (for optimistic status changes / removals). */
export function useContentList(
  enabled: boolean,
  options: { includePosterUploads?: boolean } = {},
) {
  const includePosterUploads = options.includePosterUploads === true;
  const [loadError, setLoadError] = useState<Error | null>(null);
  const key = includePosterUploads
    ? STUDIO_RESOURCE_KEYS.posterContent
    : STUDIO_RESOURCE_KEYS.content;
  const {
    data: items,
    error,
    refresh: refreshResource,
    mutate,
  } = useClientResource(key, enabled, () =>
    listContent({ includePosterUploads }),
  );
  const refresh = useCallback(async () => {
    try {
      await refreshResource(true);
      setLoadError(null);
    } catch (cause) {
      // Keep the stale rows visible; a refresh failure is not an empty list.
      // With nothing loaded yet, though, the surface needs to know.
      setLoadError(cause instanceof Error ? cause : new Error("load_failed"));
    }
  }, [refreshResource]);

  const patchRow = useCallback(
    (id: string, fields: Partial<ContentSummary>) => {
      mutate(
        (prev) =>
          prev?.map((row) => (row.id === id ? { ...row, ...fields } : row)) ??
          [],
      );
    },
    [mutate],
  );

  const removeRow = useCallback(
    (id: string) => {
      mutate((prev) => prev?.filter((row) => row.id !== id) ?? []);
    },
    [mutate],
  );

  const prependRow = useCallback(
    (row: ContentSummary) => {
      mutate((prev) => [
        row,
        ...(prev ?? []).filter((item) => item.id !== row.id),
      ]);
    },
    [mutate],
  );

  /** Set only when no rows have ever loaded and the fetch failed. */
  const loadFailed = items === null && Boolean(loadError ?? error);

  return { items, loadFailed, refresh, patchRow, removeRow, prependRow };
}
