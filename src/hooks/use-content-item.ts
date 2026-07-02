"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getContent,
  patchContent,
  type ContentDetail,
  type ContentPatch,
} from "@/lib/content/client";
import { useAutosave, type SaveState } from "@/hooks/use-autosave";

interface Loaded {
  id: string;
  item: ContentDetail | null;
  missing: boolean;
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
} {
  // Loading is derived: we're loading whenever the fetched result isn't for
  // the current id (avoids sync setState-in-effect resets on id change).
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  useEffect(() => {
    let active = true;
    getContent(id).then(
      (detail) => {
        if (active) setLoaded({ id, item: detail, missing: false });
      },
      () => {
        if (active) setLoaded({ id, item: null, missing: true });
      },
    );
    return () => {
      active = false;
    };
  }, [id]);

  const current = loaded?.id === id ? loaded : null;

  const save = useCallback(
    async (dirty: ContentPatch, opts?: { keepalive?: boolean }) => {
      await patchContent(id, dirty, opts);
    },
    [id],
  );
  const { state: saveState, queue } = useAutosave<ContentPatch>(save);

  const update = useCallback(
    (fields: ContentPatch) => {
      setLoaded((prev) =>
        prev && prev.id === id && prev.item
          ? { ...prev, item: { ...prev.item, ...fields } }
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
  };
}
