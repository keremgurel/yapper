"use client";

import { useCallback, useEffect, useState } from "react";
import {
  createView,
  deleteView,
  listViews,
  updateView,
  type LibraryView,
  type ViewDraft,
} from "@/lib/views/client";
import type { ContentStage } from "@/lib/db/schema";

/**
 * The creator's saved views for one surface, plus the one they are looking at.
 *
 * The active view is local state rather than another stored field: which tab
 * you last had open is a per-tab, per-moment thing, and persisting it would
 * mean two browser windows fought over it.
 */
export function useLibraryViews(stage: ContentStage, enabled: boolean) {
  const [views, setViews] = useState<LibraryView[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let live = true;
    listViews(stage).then(
      (rows) => {
        if (!live) return;
        setViews(rows);
        setActiveId((current) => current ?? rows[0]?.id ?? null);
      },
      () => {
        // The table still works with no views, but the failure is surfaced
        // rather than swallowed: an empty list and a broken request look
        // identical on screen, and that is exactly how this feature once
        // shipped completely invisible behind a 500.
        if (!live) return;
        setViews([]);
        setFailed(true);
      },
    );
    return () => {
      live = false;
    };
  }, [stage, enabled]);

  const create = useCallback(
    async (draft: ViewDraft) => {
      const view = await createView(stage, draft);
      setViews((rows) => [...(rows ?? []), view]);
      setActiveId(view.id);
    },
    [stage],
  );

  const save = useCallback(async (id: string, draft: ViewDraft) => {
    const view = await updateView(id, draft);
    setViews((rows) => (rows ?? []).map((r) => (r.id === id ? view : r)));
  }, []);

  const remove = useCallback(async (id: string) => {
    await deleteView(id);
    setViews((rows) => {
      const next = (rows ?? []).filter((r) => r.id !== id);
      setActiveId((current) =>
        current === id ? (next[0]?.id ?? null) : current,
      );
      return next;
    });
  }, []);

  const active = (views ?? []).find((v) => v.id === activeId) ?? null;

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
