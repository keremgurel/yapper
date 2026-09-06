"use client";

import { useCallback, useState } from "react";
import { useAutosave } from "@/hooks/use-autosave";
import { useClientResource } from "@/hooks/use-client-resource";
import { retainNewerEdits } from "@/lib/save-queue";
import {
  getProject,
  patchProject,
  type ProjectPatch,
} from "@/lib/project/client";
import {
  mutateClientResource,
  STUDIO_RESOURCE_KEYS,
} from "@/lib/client-resource-cache";

/** Saved server values plus only the fields that are still being edited. */
export function useProject(enabled: boolean) {
  const { data, error, refresh } = useClientResource(
    STUDIO_RESOURCE_KEYS.project,
    enabled,
    getProject,
  );
  const [draft, setDraft] = useState<ProjectPatch>({});
  const save = useCallback(
    async (dirty: ProjectPatch, options?: { keepalive?: boolean }) => {
      const payload = await patchProject(dirty, options);
      mutateClientResource(STUDIO_RESOURCE_KEYS.project, payload);
      // A response to an earlier save must never reset text typed in the meantime.
      setDraft((current) => retainNewerEdits(current, dirty));
    },
    [],
  );
  const { state: saveState, queue, flush } = useAutosave<ProjectPatch>(save);

  const update = useCallback(
    (fields: ProjectPatch) => {
      if (!data) return;
      setDraft((current) => ({ ...current, ...fields }));
      queue(fields);
    },
    [data, queue],
  );

  const updateAndSave = useCallback(
    async (fields: ProjectPatch) => {
      if (!data) throw new Error("project_unavailable");
      update(fields);
      await flush();
    },
    [data, update, flush],
  );

  const { pillars, ...projectFields } = draft;
  return {
    project: data ? { ...data.project, ...projectFields } : null,
    pillars: pillars ?? data?.pillars ?? [],
    loading: enabled && !data && !error,
    loadError: data ? null : error,
    saveState,
    update,
    updateAndSave,
    retry: flush,
    refresh,
  };
}
