"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getContent,
  patchContent,
  type ContentDetail,
  type ContentPatch,
} from "@/lib/content/client";
import { useAutosave, type SaveState } from "@/hooks/use-autosave";
import { normalizeHooks } from "@/lib/content/normalize";
import {
  mutateClientResource,
  readClientResource,
  STUDIO_RESOURCE_KEYS,
} from "@/lib/client-resource-cache";
import type { ContentSummary } from "@/lib/content/client";

interface Loaded {
  id: string;
  item: ContentDetail | null;
  missing: boolean;
  error: boolean;
}

/**
 * One library item for the workbench: fetch it, hold the editable local copy,
 * and autosave edits through a single serialized queue. `update` is the only
 * writer; AI generation results must also flow through it so there is never a
 * second concurrent PATCH path.
 */
export function useContentItem(id: string): {
  item: ContentDetail | null;
  loading: boolean;
  missing: boolean;
  saveState: SaveState;
  update: (fields: ContentPatch) => void;
  loadError: boolean;
  reload: () => void;
  flush: () => Promise<void>;
} {
  // Loading is derived: we're loading whenever the fetched result isn't for
  // the current id (avoids sync setState-in-effect resets on id change).
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let active = true;
    getContent(id).then(
      (detail) => {
        if (active)
          setLoaded({ id, item: detail, missing: false, error: false });
      },
      (cause: unknown) => {
        const missing =
          cause instanceof Error && cause.message === "content_api_404";
        if (active) setLoaded({ id, item: null, missing, error: !missing });
      },
    );
    return () => {
      active = false;
    };
  }, [id, version]);

  const current = loaded?.id === id ? loaded : null;

  const save = useCallback(
    async (dirty: ContentPatch, opts?: { keepalive?: boolean }) => {
      const saved = await patchContent(id, dirty, opts);
      for (const key of [
        STUDIO_RESOURCE_KEYS.content,
        STUDIO_RESOURCE_KEYS.posterContent,
      ]) {
        const rows = readClientResource<ContentSummary[]>(key);
        if (rows)
          mutateClientResource(
            key,
            rows.map((row) => (row.id === id ? saved : row)),
          );
      }
    },
    [id],
  );
  const { state: saveState, queue, flush } = useAutosave<ContentPatch>(save);

  const update = useCallback(
    (fields: ContentPatch) => {
      setLoaded((prev) =>
        prev && prev.id === id && prev.item
          ? {
              ...prev,
              item: {
                ...prev.item,
                ...fields,
                // A patch may carry either hook shape; local state keeps the
                // normalized one so the UI never sees a bare string.
                hooks:
                  fields.hooks === undefined
                    ? prev.item.hooks
                    : normalizeHooks(fields.hooks),
              },
            }
          : prev,
      );
      queue(fields);
    },
    [id, queue],
  );

  return {
    item: current?.item ?? null,
    loading: current === null,
    missing: current?.missing ?? false,
    saveState,
    update,
    loadError: current?.error ?? false,
    reload: () => setVersion((value) => value + 1),
    flush,
  };
}
