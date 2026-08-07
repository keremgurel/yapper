import { and, asc, eq, inArray, notInArray } from "drizzle-orm";
import { getDb } from "./client";
import { bumpProjectContext } from "./projects";
import { projectPillars } from "./schema";

export type PillarRow = typeof projectPillars.$inferSelect;

/** One pillar as the client sends it. An `id` means "update this one"; its
 * absence means "create". Order in the array is the display order. */
export interface PillarInput {
  id?: string;
  name: string;
  description?: string;
  examples?: string[];
}

export async function listPillars(projectId: string): Promise<PillarRow[]> {
  return getDb()
    .select()
    .from(projectPillars)
    .where(eq(projectPillars.projectId, projectId))
    .orderBy(asc(projectPillars.sortOrder), asc(projectPillars.createdAt));
}

/**
 * Replace a project's pillar list in one transaction.
 *
 * Deliberately an upsert-by-id rather than a delete-all-and-reinsert: pillar
 * ids are referenced by content items, so recreating them on every rename would
 * silently orphan every classified item. Pillars missing from `inputs` are
 * removed; the rest keep their id and get the array position as `sortOrder`.
 */
export async function replacePillars(
  projectId: string,
  inputs: PillarInput[],
): Promise<PillarRow[]> {
  const db = getDb();
  await db.transaction(async (tx) => {
    const keptIds = inputs
      .map((p) => p.id)
      .filter((id): id is string => Boolean(id));

    await tx
      .delete(projectPillars)
      .where(
        keptIds.length
          ? and(
              eq(projectPillars.projectId, projectId),
              notInArray(projectPillars.id, keptIds),
            )
          : eq(projectPillars.projectId, projectId),
      );

    for (const [index, pillar] of inputs.entries()) {
      const values = {
        name: pillar.name,
        description: pillar.description ?? "",
        examples: pillar.examples ?? [],
        sortOrder: index,
      };
      if (pillar.id) {
        await tx
          .update(projectPillars)
          .set(values)
          .where(
            and(
              eq(projectPillars.id, pillar.id),
              eq(projectPillars.projectId, projectId),
            ),
          );
      } else {
        await tx
          .insert(projectPillars)
          .values({ projectId, ...values })
          // A name that already exists is a rename collision, not an error
          // worth failing the whole save over; the existing pillar wins.
          .onConflictDoNothing({
            target: [projectPillars.projectId, projectPillars.name],
          });
      }
    }
  });

  await bumpProjectContext(projectId);
  return listPillars(projectId);
}

/**
 * Create any of `names` that the project does not already have, appended after
 * the existing pillars. Used to seed from onboarding and to reconcile the
 * legacy free-text `contentItems.pillar` values. Existing pillars are never
 * touched, so this is safe to run repeatedly.
 */
export async function ensurePillars(
  projectId: string,
  names: string[],
): Promise<void> {
  const clean = names
    .map((n) => n.trim())
    .filter(Boolean)
    .filter((n, i, all) => all.findIndex((o) => eqName(o, n)) === i);
  if (!clean.length) return;

  const existing = await listPillars(projectId);
  const missing = clean.filter(
    (name) => !existing.some((p) => eqName(p.name, name)),
  );
  if (!missing.length) return;

  await getDb()
    .insert(projectPillars)
    .values(
      missing.map((name, i) => ({
        projectId,
        name,
        sortOrder: existing.length + i,
      })),
    )
    .onConflictDoNothing({
      target: [projectPillars.projectId, projectPillars.name],
    });
  await bumpProjectContext(projectId);
}

/** Match pillar names the way a human would: case and padding do not matter. */
function eqName(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/** Look up pillars by id, scoped to the project so a caller can never resolve
 * someone else's pillar by guessing a uuid. */
export async function pillarsByIds(
  projectId: string,
  ids: string[],
): Promise<PillarRow[]> {
  if (!ids.length) return [];
  return getDb()
    .select()
    .from(projectPillars)
    .where(
      and(
        eq(projectPillars.projectId, projectId),
        inArray(projectPillars.id, ids),
      ),
    );
}
