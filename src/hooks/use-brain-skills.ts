"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAutosave, type SaveState } from "@/hooks/use-autosave";
import { mergeRecordPatches } from "@/lib/save-queue";
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
  available: boolean;
  saveState: SaveState;
  error: string | null;
  retry: () => Promise<void>;
  edit: (id: string, patch: BrainSkillPatch) => void;
  add: (skill: BrainSkillPatch & { name: string }) => Promise<BrainSkill>;
  remove: (id: string) => Promise<void>;
  reset: (skill: BrainSkill) => Promise<BrainSkill>;
  refresh: () => Promise<void>;
} {
  const [skills, setSkills] = useState<BrainSkill[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const revision = useRef(0);
  const deleting = useRef(new Set<string>());

  useEffect(() => {
    let active = true;
    listSkills().then(
      (loaded) => {
        if (active) {
          setSkills(loaded);
          setLoaded(true);
          setError(null);
        }
      },
      () => {
        if (active) {
          setError("Your Skills couldn’t be loaded. Try again.");
          setLoaded(true);
        }
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
  } = useAutosave<Record<string, BrainSkillPatch>>(
    save,
    800,
    mergeRecordPatches,
  );

  const load = useCallback(async () => {
    try {
      await flush();
      const started = revision.current;
      const result = await listSkills();
      if (started === revision.current) setSkills(result);
      setError(null);
    } catch {
      setError("Your Skills couldn’t be loaded. Try again.");
    } finally {
      setLoaded(true);
    }
  }, [flush]);

  const edit = useCallback(
    (id: string, patch: BrainSkillPatch) => {
      if (deleting.current.has(id)) return;
      revision.current++;
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

  const add = useCallback(
    async (input: BrainSkillPatch & { name: string }) => {
      if (skills === null) throw new Error("skills_not_loaded");
      try {
        const skill = await createSkill(input);
        revision.current++;
        setSkills((prev) => [...(prev ?? []), skill]);
        setError(null);
        return skill;
      } catch (cause) {
        setError("That Skill couldn’t be added. Try again.");
        throw cause;
      }
    },
    [skills],
  );

  const remove = useCallback(
    async (id: string) => {
      if (deleting.current.has(id)) return;
      deleting.current.add(id);
      try {
        await flush();
        await deleteSkill(id);
        revision.current++;
        setSkills((prev) => prev?.filter((skill) => skill.id !== id) ?? prev);
        setError(null);
      } catch (cause) {
        setError("That Skill couldn’t be removed. It is still here.");
        throw cause;
      } finally {
        deleting.current.delete(id);
      }
    },
    [flush],
  );

  const reset = useCallback(
    async (current: BrainSkill) => {
      if (!current.catalogSlug) throw new Error("skill_has_no_default");
      // A reset must sit after any pending autosave. Otherwise the last edit
      // typed before pressing Reset could arrive later and overwrite the
      // catalog copy we just restored.
      await flush();
      const result = await installCatalogEntry(current.catalogSlug);
      if (!result.skill) throw new Error("catalog_skill_not_found");
      revision.current++;
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
    loading: !loaded,
    available: skills !== null,
    error,
    retry: flush,
    saveState,
    edit,
    add,
    remove,
    reset,
    refresh: load,
  };
}
