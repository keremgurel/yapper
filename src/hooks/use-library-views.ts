"use client";

import { useCallback, useState } from "react";
import {
  createView,
  deleteView,
  listViews,
  updateView,
  type ViewDraft,
} from "@/lib/views/client";
import type { ContentStage } from "@/lib/db/schema";
import { STUDIO_RESOURCE_KEYS } from "@/lib/client-resource-cache";
import { useClientResource } from "@/hooks/use-client-resource";

/**
 * The creator's saved views for one surface, plus the one they are looking at.
 *
 * The active view is local state rather than another stored field: which tab
 * you last had open is a per-tab, per-moment thing, and persisting it would
 * mean two browser windows fought over it.
 */
export function useLibraryViews(stage: ContentStage, enabled: boolean) {
  const [failed, setFailed] = useState(false);
  const { data: views, mutate: setViews } = useClientResource(
    STUDIO_RESOURCE_KEYS.views(stage),
    enabled,
    () =>
      listViews(stage).catch(() => {
        setFailed(true);
        return [];
      }),
  );
  const [activeId, setActiveId] = useState<string | null>(null);

  const create = useCallback(
    async (draft: ViewDraft) => {
      const view = await createView(stage, draft);
      setViews((rows) => [...(rows ?? []), view]);
      setActiveId(view.id);
    },
    [stage, setViews],
  );

  const save = useCallback(
    async (id: string, draft: ViewDraft) => {
      const view = await updateView(id, draft);
      setViews((rows) => (rows ?? []).map((r) => (r.id === id ? view : r)));
    },
    [setViews],
  );

  const remove = useCallback(
    async (id: string) => {
      await deleteView(id);
      setViews((rows) => {
        const next = (rows ?? []).filter((r) => r.id !== id);
        setActiveId((current) =>
          current === id ? (next[0]?.id ?? null) : current,
        );
        return next;
      });
    },
    [setViews],
  );

  const resolvedActiveId = activeId ?? views?.[0]?.id ?? null;
  const active =
    (views ?? []).find((view) => view.id === resolvedActiveId) ?? null;

  return {
    views: views ?? [],
    active,
    failed,
    setActiveId,
    create,
    save,
    remove,
  };
}
