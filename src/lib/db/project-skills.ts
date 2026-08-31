import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { STARTER_SKILL_SLUGS } from "@/lib/brain/default-skills";
import { getDb } from "./client";
import { bumpProjectContext } from "./projects";
import { projectSkills, skillCatalog, type BrainSurface } from "./schema";

export type ProjectSkillRow = typeof projectSkills.$inferSelect;

/**
 * The creator's installed and self-written skills.
 *
 * Everything here bumps `contextVersion`, the same way block writes do, because
 * a skill changes what every prompt reads and the compiled core and index are
 * cached against that number.
 */

export interface ProjectSkillInput {
  name: string;
  whenToUse?: string;
  instructions?: string;
  surfaces?: BrainSurface[];
  enabled?: boolean;
}

export async function listProjectSkills(
  projectId: string,
): Promise<ProjectSkillRow[]> {
  return getDb()
    .select()
    .from(projectSkills)
    .where(eq(projectSkills.projectId, projectId))
    .orderBy(asc(projectSkills.sortOrder), asc(projectSkills.createdAt));
}

/**
 * Give an empty Brain its useful-on-day-one methods.
 *
 * This runs at the API boundary, making the rollout self-healing for existing
 * deployments without waiting for a schema migration. A Brain with any skill
 * already in it is never rearranged or overwritten.
 */
export async function listProjectSkillsWithDefaults(
  projectId: string,
): Promise<ProjectSkillRow[]> {
  const db = getDb();
  const [existing] = await db
    .select({ id: projectSkills.id })
    .from(projectSkills)
    .where(eq(projectSkills.projectId, projectId))
    .limit(1);

  if (!existing) {
    const catalogEntries = await db
      .select()
      .from(skillCatalog)
      .where(
        and(
          eq(skillCatalog.published, true),
          eq(skillCatalog.kind, "skill"),
          inArray(skillCatalog.slug, [...STARTER_SKILL_SLUGS]),
        ),
      );

    if (catalogEntries.length) {
      const order = new Map<string, number>(
        STARTER_SKILL_SLUGS.map((slug, index) => [slug, index]),
      );
      const inserted = await db
        .insert(projectSkills)
        .values(
          catalogEntries.map((entry) => ({
            projectId,
            catalogSlug: entry.slug,
            catalogVersion: entry.version,
            name: entry.name,
            whenToUse: entry.whenToUse,
            instructions: entry.instructions,
            surfaces: entry.surfaces,
            enabled: true,
            customized: false,
            sortOrder: order.get(entry.slug) ?? STARTER_SKILL_SLUGS.length,
          })),
        )
        .onConflictDoNothing({
          target: [projectSkills.projectId, projectSkills.catalogSlug],
        })
        .returning({ id: projectSkills.id });
      if (inserted.length) await bumpProjectContext(projectId);
    }
  }

  return listProjectSkills(projectId);
}

async function nextSortOrder(projectId: string): Promise<number> {
  const [{ next } = { next: 0 }] = await getDb()
    .select({
      next: sql<number>`coalesce(max(${projectSkills.sortOrder}) + 1, 0)`,
    })
    .from(projectSkills)
    .where(eq(projectSkills.projectId, projectId));
  return next;
}

export async function createProjectSkill(
  projectId: string,
  input: ProjectSkillInput,
): Promise<ProjectSkillRow> {
  const [row] = await getDb()
    .insert(projectSkills)
    .values({
      projectId,
      name: input.name,
      whenToUse: input.whenToUse ?? "",
      instructions: input.instructions ?? "",
      surfaces: input.surfaces ?? [],
      enabled: input.enabled ?? true,
      sortOrder: await nextSortOrder(projectId),
    })
    .returning();
  await bumpProjectContext(projectId);
  return row;
}

/**
 * Install a catalog entry as the creator's own copy.
 *
 * A copy, not a reference. The creator can rewrite an installed skill into
 * something that only makes sense for them, and an edit we make to the catalog
 * later must never silently rewrite what a brain is running. Re-installing
 * refreshes the copy, which is what the "update available" button does, and it
 * clears `customized` because the creator has just chosen our text over theirs.
 */
export async function installCatalogSkill(
  projectId: string,
  entry: {
    slug: string;
    version: number;
    name: string;
    whenToUse: string;
    instructions: string;
    surfaces: BrainSurface[];
  },
): Promise<ProjectSkillRow> {
  const [row] = await getDb()
    .insert(projectSkills)
    .values({
      projectId,
      catalogSlug: entry.slug,
      catalogVersion: entry.version,
      name: entry.name,
      whenToUse: entry.whenToUse,
      instructions: entry.instructions,
      surfaces: entry.surfaces,
      enabled: true,
      customized: false,
      sortOrder: await nextSortOrder(projectId),
    })
    .onConflictDoUpdate({
      target: [projectSkills.projectId, projectSkills.catalogSlug],
      set: {
        catalogVersion: entry.version,
        name: entry.name,
        whenToUse: entry.whenToUse,
        instructions: entry.instructions,
        surfaces: entry.surfaces,
        enabled: true,
        customized: false,
        updatedAt: new Date(),
      },
    })
    .returning();
  await bumpProjectContext(projectId);
  return row;
}

/**
 * Save an edit. Touching the text of an installed skill marks it customized, so
 * a later catalog update knows to ask before overwriting the creator's version.
 * Toggling it on or off is not an edit to the text and does not.
 */
export async function updateProjectSkill(
  projectId: string,
  id: string,
  input: Partial<ProjectSkillInput>,
): Promise<ProjectSkillRow | null> {
  const patch: Partial<ProjectSkillRow> = { updatedAt: new Date() };
  const textChanged =
    input.name !== undefined ||
    input.whenToUse !== undefined ||
    input.instructions !== undefined ||
    input.surfaces !== undefined;

  if (input.name !== undefined) patch.name = input.name;
  if (input.whenToUse !== undefined) patch.whenToUse = input.whenToUse;
  if (input.instructions !== undefined) patch.instructions = input.instructions;
  if (input.surfaces !== undefined) patch.surfaces = input.surfaces;
  if (input.enabled !== undefined) patch.enabled = input.enabled;
  if (textChanged) patch.customized = true;

  const [row] = await getDb()
    .update(projectSkills)
    .set(patch)
    .where(
      and(eq(projectSkills.id, id), eq(projectSkills.projectId, projectId)),
    )
    .returning();
  if (row) await bumpProjectContext(projectId);
  return row ?? null;
}

export async function deleteProjectSkill(
  projectId: string,
  id: string,
): Promise<boolean> {
  const rows = await getDb()
    .delete(projectSkills)
    .where(
      and(eq(projectSkills.id, id), eq(projectSkills.projectId, projectId)),
    )
    .returning({ id: projectSkills.id });
  if (rows.length) await bumpProjectContext(projectId);
  return rows.length > 0;
}

/** The creator's own order, by id. Ids that are not theirs are ignored. */
export async function reorderProjectSkills(
  projectId: string,
  ids: string[],
): Promise<ProjectSkillRow[]> {
  const db = getDb();
  await db.transaction(async (tx) => {
    for (const [index, id] of ids.entries()) {
      await tx
        .update(projectSkills)
        .set({ sortOrder: index })
        .where(
          and(eq(projectSkills.id, id), eq(projectSkills.projectId, projectId)),
        );
    }
  });
  await bumpProjectContext(projectId);
  return listProjectSkills(projectId);
}
