import { and, asc, eq } from "drizzle-orm";
import { getDb } from "./client";
import {
  skillCatalog,
  type BrainSurface,
  type CatalogEntryKind,
} from "./schema";

export type SkillCatalogRow = typeof skillCatalog.$inferSelect;

/**
 * The shelf a creator browses.
 *
 * In the database rather than in the repo so an entry can be written, fixed or
 * pulled without a deploy, and so the wording of a skill (which is prompt text,
 * and is therefore something we will keep tuning) is not a code change.
 */

export interface SkillCatalogInput {
  slug: string;
  kind?: CatalogEntryKind;
  name: string;
  tagline?: string;
  whenToUse?: string;
  instructions?: string;
  surfaces?: BrainSurface[];
  category?: string;
  published?: boolean;
  sortOrder?: number;
}

/** What the browse sheet shows. Unpublished entries are drafts and never leave
 * the admin surface. */
export async function listPublishedCatalog(): Promise<SkillCatalogRow[]> {
  return getDb()
    .select()
    .from(skillCatalog)
    .where(eq(skillCatalog.published, true))
    .orderBy(asc(skillCatalog.sortOrder), asc(skillCatalog.name));
}

export async function listAllCatalog(): Promise<SkillCatalogRow[]> {
  return getDb()
    .select()
    .from(skillCatalog)
    .orderBy(asc(skillCatalog.sortOrder), asc(skillCatalog.name));
}

export async function getPublishedCatalogEntry(
  slug: string,
): Promise<SkillCatalogRow | null> {
  const [row] = await getDb()
    .select()
    .from(skillCatalog)
    .where(and(eq(skillCatalog.slug, slug), eq(skillCatalog.published, true)))
    .limit(1);
  return row ?? null;
}

export async function createCatalogEntry(
  input: SkillCatalogInput,
): Promise<SkillCatalogRow> {
  const [row] = await getDb()
    .insert(skillCatalog)
    .values({
      slug: input.slug,
      kind: input.kind ?? "skill",
      name: input.name,
      tagline: input.tagline ?? "",
      whenToUse: input.whenToUse ?? "",
      instructions: input.instructions ?? "",
      surfaces: input.surfaces ?? [],
      category: input.category ?? "",
      published: input.published ?? false,
      sortOrder: input.sortOrder ?? 0,
    })
    .returning();
  return row;
}

/**
 * Edit an entry. Any change to the text bumps `version`, which is the whole
 * mechanism behind "update available": an installed copy compares its stored
 * version against this one and offers the difference.
 */
export async function updateCatalogEntry(
  id: string,
  input: Partial<SkillCatalogInput>,
): Promise<SkillCatalogRow | null> {
  const patch: Partial<SkillCatalogRow> = { updatedAt: new Date() };
  const textChanged =
    input.name !== undefined ||
    input.whenToUse !== undefined ||
    input.instructions !== undefined ||
    input.surfaces !== undefined;

  if (input.slug !== undefined) patch.slug = input.slug;
  if (input.kind !== undefined) patch.kind = input.kind;
  if (input.name !== undefined) patch.name = input.name;
  if (input.tagline !== undefined) patch.tagline = input.tagline;
  if (input.whenToUse !== undefined) patch.whenToUse = input.whenToUse;
  if (input.instructions !== undefined) patch.instructions = input.instructions;
  if (input.surfaces !== undefined) patch.surfaces = input.surfaces;
  if (input.category !== undefined) patch.category = input.category;
  if (input.published !== undefined) patch.published = input.published;
  if (input.sortOrder !== undefined) patch.sortOrder = input.sortOrder;

  const db = getDb();
  const [row] = await db
    .update(skillCatalog)
    .set(
      textChanged
        ? { ...patch, version: (await currentVersion(id)) + 1 }
        : patch,
    )
    .where(eq(skillCatalog.id, id))
    .returning();
  return row ?? null;
}

async function currentVersion(id: string): Promise<number> {
  const [row] = await getDb()
    .select({ version: skillCatalog.version })
    .from(skillCatalog)
    .where(eq(skillCatalog.id, id))
    .limit(1);
  return row?.version ?? 1;
}

export async function deleteCatalogEntry(id: string): Promise<boolean> {
  const rows = await getDb()
    .delete(skillCatalog)
    .where(eq(skillCatalog.id, id))
    .returning({ id: skillCatalog.id });
  return rows.length > 0;
}
