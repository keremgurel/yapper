"use client";

import { useCallback, useEffect, useState } from "react";
import { useAutosave, type SaveState } from "@/hooks/use-autosave";
import {
  createSkill,
  deleteSkill,
  listSkills,
  patchSkill,
  type BrainSkill,
  type BrainSkillPatch,
} from "@/lib/brain/skills-client";
import { installCatalogEntry } from "@/lib/brain/catalog-client";

/**
 * The creator's skills.
 *
 * The same shape as the sections hook, and for the same reason: a skill is the
 * unit the creator thinks in, so editing the instructions of one must never be
 * gated on a save in another, and a slow PATCH on a long skill must never land
 * after and overwrite the switch they flipped afterwards.
 */
export function useBrainSkills(): {
  skills: BrainSkill[];
  loading: boolean;
  saveState: SaveState;
  edit: (id: string, patch: BrainSkillPatch) => void;
  add: (skill: BrainSkillPatch & { name: string }) => Promise<BrainSkill>;
  remove: (id: string) => Promise<void>;
  reset: (skill: BrainSkill) => Promise<BrainSkill>;
  refresh: () => Promise<void>;
} {
  const [skills, setSkills] = useState<BrainSkill[] | null>(null);

  const load = useCallback(async () => {
    try {
      setSkills(await listSkills());
    } catch {
      // An empty list the creator can still add to beats an error they can do
      // nothing about; the next save reports the real failure.
      setSkills([]);
    }
  }, []);

  useEffect(() => {
    let active = true;
    listSkills().then(
      (loaded) => {
        if (active) setSkills(loaded);
      },
      () => {
        if (active) setSkills([]);
      },
    );
    return () => {
      active = false;
    };
  }, []);

  const save = useCallback(
    async (
      dirty: Partial<Record<string, BrainSkillPatch>>,
      opts?: { keepalive?: boolean },
    ) => {
      for (const [id, patch] of Object.entries(dirty)) {
        if (patch) await patchSkill(id, patch, opts);
      }
    },
    [],
  );
  const {
    state: saveState,
    queue,
    flush,
  } = useAutosave<Record<string, BrainSkillPatch>>(save);

  const edit = useCallback(
    (id: string, patch: BrainSkillPatch) => {
      setSkills((prev) =>
        prev
          ? prev.map((skill) =>
              skill.id === id ? { ...skill, ...patch } : skill,
            )
          : prev,
      );
      // Merged by id, so two edits to the same skill collapse into one PATCH.
      queue({ [id]: patch });
    },
    [queue],
  );

  const add = useCallback(async (input: BrainSkillPatch & { name: string }) => {
    const skill = await createSkill(input);
    setSkills((prev) => [...(prev ?? []), skill]);
    return skill;
  }, []);

  const remove = useCallback(async (id: string) => {
    setSkills((prev) => prev?.filter((skill) => skill.id !== id) ?? prev);
    await deleteSkill(id);
  }, []);

  const reset = useCallback(
    async (current: BrainSkill) => {
      if (!current.catalogSlug) throw new Error("skill_has_no_default");
      // A reset must sit after any pending autosave. Otherwise the last edit
      // typed before pressing Reset could arrive later and overwrite the
      // catalog copy we just restored.
      await flush();
      const result = await installCatalogEntry(current.catalogSlug);
      if (!result.skill) throw new Error("catalog_skill_not_found");
      setSkills(
        (previous) =>
          previous?.map((skill) =>
            skill.id === current.id ? result.skill! : skill,
          ) ?? previous,
      );
      return result.skill;
    },
    [flush],
  );

  return {
    skills: skills ?? [],
    loading: skills === null,
    saveState,
    edit,
    add,
    remove,
    reset,
    refresh: load,
  };
}
