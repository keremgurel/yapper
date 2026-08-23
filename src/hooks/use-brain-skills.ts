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
  const { state: saveState, queue } =
    useAutosave<Record<string, BrainSkillPatch>>(save);

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

  return {
    skills: skills ?? [],
    loading: skills === null,
    saveState,
    edit,
    add,
    remove,
    refresh: load,
  };
}
