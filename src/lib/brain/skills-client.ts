import type { BrainSurface } from "@/lib/db/schema";

/** One skill, as the page sees it. */
export interface BrainSkill {
  id: string;
  catalogSlug: string | null;
  catalogVersion: number | null;
  name: string;
  whenToUse: string;
  instructions: string;
  /** Empty means every surface. */
  surfaces: BrainSurface[];
  enabled: boolean;
  /** Set once the creator has edited an installed copy. */
  customized: boolean;
  sortOrder: number;
}

export type BrainSkillPatch = Partial<
  Pick<
    BrainSkill,
    "name" | "whenToUse" | "instructions" | "surfaces" | "enabled"
  >
>;

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`skills_api_${res.status}`);
  return (await res.json()) as T;
}

export async function listSkills(): Promise<BrainSkill[]> {
  return (
    await json<{ skills: BrainSkill[] }>(await fetch("/api/brain/skills"))
  ).skills;
}

export async function createSkill(
  skill: BrainSkillPatch & { name: string },
): Promise<BrainSkill> {
  return (
    await json<{ skill: BrainSkill }>(
      await fetch("/api/brain/skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(skill),
      }),
    )
  ).skill;
}

/** `keepalive` lets a final autosave flush survive a hard navigation. */
export async function patchSkill(
  id: string,
  patch: BrainSkillPatch,
  opts: { keepalive?: boolean } = {},
): Promise<BrainSkill> {
  return (
    await json<{ skill: BrainSkill }>(
      await fetch(`/api/brain/skills/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
        keepalive: opts.keepalive,
      }),
    )
  ).skill;
}

export async function deleteSkill(id: string): Promise<void> {
  await json<{ ok: true }>(
    await fetch(`/api/brain/skills/${id}`, { method: "DELETE" }),
  );
}
