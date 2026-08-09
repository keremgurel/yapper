import { and, asc, eq, sql } from "drizzle-orm";
import { getDb } from "./client";
import { bumpProjectContext } from "./projects";
import { projectBrainBlocks, type BrainBlockKind } from "./schema";

export type BrainBlockRow = typeof projectBrainBlocks.$inferSelect;

/** A block as the client sends it. Everything but the title is optional, so a
 * half-written block is still a block: an empty one the creator will come back
 * to beats a form they abandoned. */
export interface BrainBlockInput {
  title: string;
  kind?: BrainBlockKind;
  body?: string;
  items?: string[];
  inContext?: boolean;
}

export async function listBrainBlocks(
  projectId: string,
): Promise<BrainBlockRow[]> {
  return getDb()
    .select()
    .from(projectBrainBlocks)
    .where(eq(projectBrainBlocks.projectId, projectId))
    .orderBy(
      asc(projectBrainBlocks.sortOrder),
      asc(projectBrainBlocks.createdAt),
    );
}

export async function createBrainBlock(
  projectId: string,
  input: BrainBlockInput,
): Promise<BrainBlockRow> {
  const db = getDb();
  // Appended, not prepended: the creator arranges the page themselves, and a
  // new block landing at the top would reorder the one they were reading.
  const [{ next } = { next: 0 }] = await db
    .select({
      next: sql<number>`coalesce(max(${projectBrainBlocks.sortOrder}) + 1, 0)`,
    })
    .from(projectBrainBlocks)
    .where(eq(projectBrainBlocks.projectId, projectId));

  const [row] = await db
    .insert(projectBrainBlocks)
    .values({
      projectId,
      title: input.title,
      kind: input.kind ?? "note",
      body: input.body ?? "",
      items: input.items ?? [],
      inContext: input.inContext ?? true,
      sortOrder: next,
    })
    .returning();
  await bumpProjectContext(projectId);
  return row;
}

/**
 * Save an edit. Absent keys are left alone, so the page's autosave can send
 * only the field that changed.
 *
 * Scoped by project as well as id: an id is a guess away from another
 * creator's block, and the project is the thing the caller has proven they own.
 */
export async function updateBrainBlock(
  projectId: string,
  id: string,
  input: Partial<BrainBlockInput>,
): Promise<BrainBlockRow | null> {
  const patch: Partial<BrainBlockRow> = { updatedAt: new Date() };
  if (input.title !== undefined) patch.title = input.title;
  if (input.kind !== undefined) patch.kind = input.kind;
  if (input.body !== undefined) patch.body = input.body;
  if (input.items !== undefined) patch.items = input.items;
  if (input.inContext !== undefined) patch.inContext = input.inContext;

  const [row] = await getDb()
    .update(projectBrainBlocks)
    .set(patch)
    .where(
      and(
        eq(projectBrainBlocks.id, id),
        eq(projectBrainBlocks.projectId, projectId),
      ),
    )
    .returning();
  if (row) await bumpProjectContext(projectId);
  return row ?? null;
}

export async function deleteBrainBlock(
  projectId: string,
  id: string,
): Promise<boolean> {
  const rows = await getDb()
    .delete(projectBrainBlocks)
    .where(
      and(
        eq(projectBrainBlocks.id, id),
        eq(projectBrainBlocks.projectId, projectId),
      ),
    )
    .returning({ id: projectBrainBlocks.id });
  if (rows.length) await bumpProjectContext(projectId);
  return rows.length > 0;
}

/** The creator's own order, by id. Ids that are not theirs are ignored rather
 * than rejected, so a stale tab cannot reorder someone else's page. */
export async function reorderBrainBlocks(
  projectId: string,
  ids: string[],
): Promise<BrainBlockRow[]> {
  const db = getDb();
  await db.transaction(async (tx) => {
    for (const [index, id] of ids.entries()) {
      await tx
        .update(projectBrainBlocks)
        .set({ sortOrder: index })
        .where(
          and(
            eq(projectBrainBlocks.id, id),
            eq(projectBrainBlocks.projectId, projectId),
          ),
        );
    }
  });
  await bumpProjectContext(projectId);
  return listBrainBlocks(projectId);
}
