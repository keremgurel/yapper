"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  getContent,
  saveContentFields,
  type ContentDetail,
  type ContentPatch,
} from "@/lib/content/client";
import type { ContentBase } from "@/lib/content/rebase";
import { afterSave, baseFor, baseOf } from "@/lib/content/save-base";
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
  /** Records fields the server saved itself (a canvas ask), as the copy the
   * next autosave of them starts from. */
  markSaved: (fields: ContentBase) => void;
} {
  // Loading is derived: we're loading whenever the fetched result isn't for
  // the current id (avoids sync setState-in-effect resets on id change).
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [version, setVersion] = useState(0);
  // The stored copy each canvas field was last read or saved as, and the
  // newest local copy, so a save can be merged with a change made elsewhere.
  const base = useRef<ContentBase>({});
  const latest = useRef<ContentDetail | null>(null);

  useEffect(() => {
    let active = true;
    getContent(id).then(
      (detail) => {
        if (!active) return;
        base.current = baseOf(detail);
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
  useEffect(() => {
    latest.current = current?.item ?? null;
  });

  const save = useCallback(
    async (dirty: ContentPatch, opts?: { keepalive?: boolean }) => {
      const { item: saved, rebased } = await saveContentFields(
        id,
        dirty,
        baseFor(dirty, base.current),
        opts,
      );
      const next = afterSave({
        base: base.current,
        sent: dirty,
        saved,
        latest: latest.current ?? {},
        rebased,
      });
      base.current = next.base;
      // Someone else's change was merged in: show it where the creator has
      // not typed since.
      const { title, hooks, ...body } = next.show;
      if (Object.keys(next.show).length)
        setLoaded((prev) =>
          prev && prev.id === id && prev.item
            ? {
                ...prev,
                item: {
                  ...prev.item,
                  ...body,
                  title: title ?? prev.item.title,
                  hooks:
                    hooks === undefined
                      ? prev.item.hooks
                      : normalizeHooks(hooks),
                },
              }
            : prev,
        );
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
    markSaved: (fields) => {
      base.current = { ...base.current, ...fields };
    },
  };
}
