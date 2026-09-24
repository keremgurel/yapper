import { clampBlock } from "./text";
import type { BrainSkillSource, BrainSurface } from "./types";

/**
 * Skills that apply to every piece of writing, so they skip routing entirely.
 *
 * A router picks methods that fit the piece: a story structure for a story, a
 * hook method when there is a hook to write. How the writing should sound is
 * not that kind of choice. It holds for a caption as much as a script, and a
 * router that skipped it on one call would let the tells straight back in.
 *
 * The creator still owns their copy: they can edit it or switch it off, and a
 * switched-off copy is simply not read.
 */
export const ALWAYS_ON_SKILL_SLUGS: ReadonlySet<string> = new Set([
  "write-like-a-person",
]);

/** Room for the always-on rules, outside the per-task allowance so a long
 * skill chosen for the task never pushes them out. */
export const ALWAYS_ON_CAP = 2400;

export function isAlwaysOn(skill: Pick<BrainSkillSource, "slug">): boolean {
  return !!skill.slug && ALWAYS_ON_SKILL_SLUGS.has(skill.slug);
}

/** The always-on skills this surface reads. Classification writes nothing a
 * reader sees, so capture reads none. */
export function alwaysOnFor(
  skills: BrainSkillSource[],
  surface: BrainSurface,
): BrainSkillSource[] {
  if (surface === "capture") return [];
  return skills.filter(
    (skill) =>
      isAlwaysOn(skill) &&
      skill.enabled &&
      skill.instructions.trim() &&
      (skill.surfaces.length === 0 || skill.surfaces.includes(surface)),
  );
}

/** The rules as prompt text. Byte-stable for a given brain, so it caches with
 * the core. */
export function renderAlwaysOn(skills: BrainSkillSource[]): string {
  return clampBlock(
    skills.map((skill) => skill.instructions.trim()).join("\n\n"),
    ALWAYS_ON_CAP,
  );
}
