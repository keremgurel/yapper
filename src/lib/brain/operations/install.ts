import { invalidateBrainContext } from "@/lib/brain/context/server";
import { createBrainBlock, type BrainBlockRow } from "@/lib/db/project-brain";
import {
  installCatalogSkill,
  type ProjectSkillRow,
} from "@/lib/db/project-skills";
import { getPublishedCatalogEntry } from "@/lib/db/skill-catalog";
import { getActiveProject } from "@/lib/db/projects";
import { ensureUser } from "@/lib/db/users";
import {
  refused,
  succeeded,
  type OperationResult,
} from "@/lib/http/operation-result";

export type InstalledEntry =
  | { block: BrainBlockRow; skill?: undefined; name: string }
  | { skill: ProjectSkillRow; block?: undefined; name: string };

/**
 * Take a copy of a catalog entry.
 *
 * A skill entry becomes a skill the creator owns and can rewrite. A context
 * entry becomes an ordinary section, pre-filled with the prompts it asks, which
 * is the difference between handing someone a worksheet and handing them a
 * blank page titled "worksheet".
 *
 * Installing twice is not an error. For a skill it refreshes the copy, which is
 * exactly what the update button does; for a section it appends another one,
 * because two copies of a worksheet is a thing a person might actually want.
 * The catalog sheet (through /api/brain/catalog/[slug]/install) and Chirpy
 * share it.
 */
export async function installCatalogEntry(
  userId: string,
  slug: string,
): Promise<OperationResult<InstalledEntry>> {
  const entry = await getPublishedCatalogEntry(slug);
  if (!entry) return refused(404, "not_found");

  await ensureUser(userId);
  const project = await getActiveProject(userId);

  if (entry.kind === "context") {
    const block = await createBrainBlock(project.id, {
      title: entry.name,
      kind: "note",
      body: entry.instructions,
      digest: entry.tagline,
      // Never on by default. The creator has just been handed a set of
      // questions, and the answers are not in it yet; a prompt reading the
      // unanswered worksheet would write from the questions.
      usage: "manual",
      sourceLabel: "From the catalog",
    });
    invalidateBrainContext(project.id);
    return succeeded({ block, name: entry.name });
  }

  const skill = await installCatalogSkill(project.id, {
    slug: entry.slug,
    version: entry.version,
    name: entry.name,
    whenToUse: entry.whenToUse,
    instructions: entry.instructions,
    surfaces: entry.surfaces,
    formats: entry.formats,
  });
  invalidateBrainContext(project.id);
  return succeeded({ skill, name: entry.name });
}
