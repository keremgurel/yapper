"use client";

import { useCallback, useEffect, useState } from "react";
import { useAutosave, type SaveState } from "@/hooks/use-autosave";
import {
  getProject,
  patchProject,
  type Pillar,
  type PillarDraft,
  type Project,
  type ProjectPatch,
} from "@/lib/project/client";
import {
  mutateClientResource,
  STUDIO_RESOURCE_KEYS,
} from "@/lib/client-resource-cache";

/** The fetched brain. `project: null` means the load failed, which the sheet
 * reports rather than showing an empty form the creator would type into. */
interface Loaded {
  project: Project | null;
  pillars: PillarDraft[];
}

/** Pillars are held as drafts, not rows: a pillar the creator just typed has no
 * id until the server assigns one, and the editor has to render it meanwhile. */
function toDrafts(pillars: Pillar[]): PillarDraft[] {
  return pillars.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    examples: p.examples,
  }));
}

/**
 * The creator's project brain: fetch it once, hold the editable local copy, and
 * autosave through a single serialized queue.
 *
 * `update` is the only writer, and pillars ride the same queue as the text
 * fields, so a rename and a voice edit made a second apart cannot race each
 * other into two conflicting PATCHes.
 */
export function useProject(enabled: boolean): {
  project: Project | null;
  pillars: PillarDraft[];
  loading: boolean;
  saveState: SaveState;
  update: (fields: ProjectPatch) => void;
} {
  // Loading is derived from "no result yet" rather than tracked in its own
  // state, which keeps the effect free of synchronous setState.
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    getProject().then(
      (payload) => {
        if (active)
          setLoaded({
            project: payload.project,
            pillars: toDrafts(payload.pillars),
          });
      },
      () => {
        if (active) setLoaded({ project: null, pillars: [] });
      },
    );
    return () => {
      active = false;
    };
  }, [enabled]);

  const save = useCallback(
    async (dirty: ProjectPatch, opts?: { keepalive?: boolean }) => {
      const payload = await patchProject(dirty, opts);
      // Pillars are read from the shared cache by the library, the bank and the
      // workbench rail. Without this, renaming one here would leave every other
      // surface showing the old name until a reload.
      mutateClientResource(STUDIO_RESOURCE_KEYS.project, () => payload);
      // The server owns pillar ids: a pillar the creator just typed comes back
      // with the id that later edits must target, so the local list is
      // reconciled from the response rather than left as an id-less draft.
      setLoaded({
        project: payload.project,
        pillars: toDrafts(payload.pillars),
      });
    },
    [],
  );
  const { state: saveState, queue } = useAutosave<ProjectPatch>(save);

  const update = useCallback(
    (fields: ProjectPatch) => {
      // Apply locally first so typing is never gated on the debounced save.
      // Pillars are a separate list, not a project column, so they are split
      // out here rather than spread onto the project row.
      const { pillars, ...projectFields } = fields;
      setLoaded((prev) => {
        if (!prev) return prev;
        return {
          project: prev.project
            ? { ...prev.project, ...projectFields }
            : prev.project,
          pillars: pillars ?? prev.pillars,
        };
      });
      queue(fields);
    },
    [queue],
  );

  return {
    project: loaded?.project ?? null,
    pillars: loaded?.pillars ?? [],
    loading: enabled && loaded === null,
    saveState,
    update,
  };
}
