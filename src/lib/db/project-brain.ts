import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { chunkDocument } from "@/lib/brain/context/chunk";
import { getDb } from "./client";
import { bumpProjectContext } from "./projects";
import {
  projectBrainBlocks,
  projectBrainChunks,
  type BrainBlockKind,
  type BrainBlockUsage,
  type BrainTable,
} from "./schema";

export type BrainBlockRow = typeof projectBrainBlocks.$inferSelect;
export type BrainChunkRow = typeof projectBrainChunks.$inferSelect;

/** A block as the client sends it. Everything but the title is optional, so a
 * half-written block is still a block: an empty one the creator will come back
 * to beats a form they abandoned. */
export interface BrainBlockInput {
  title: string;
  kind?: BrainBlockKind;
  body?: string;
  items?: string[];
  rows?: BrainTable | null;
  digest?: string;
  usage?: BrainBlockUsage;
  tags?: string[];
  sourceLabel?: string;
  sourceUrl?: string;
}

/** Derived, never taken from the client: the page uses it for the budget meter
 * and a client that could inflate it could make the meter lie. */
function contentCharCount(row: {
  body: string;
  items: string[];
  rows: BrainTable | null;
}): number {
  const items = row.items.reduce((total, item) => total + item.length, 0);
  const table = (row.rows?.rows ?? []).reduce(
    (total, cells) =>
      total + cells.reduce((cellTotal, cell) => cellTotal + cell.length, 0),
    0,
  );
  return row.body.length + items + table;
}

/**
 * Keep a document block's slices in step with its text.
 *
 * Rewritten wholesale rather than diffed. A doc block is edited rarely and read
 * often, the chunker is deterministic, and a diff that got the boundaries
 * subtly wrong would leave the compiler quoting two halves of a sentence.
 */
async function syncChunks(
  blockId: string,
  kind: BrainBlockKind,
  body: string,
): Promise<void> {
  const db = getDb();
  await db
    .delete(projectBrainChunks)
    .where(eq(projectBrainChunks.blockId, blockId));
  if (kind !== "doc") return;
  const chunks = chunkDocument(body);
  if (!chunks.length) return;
  await db.insert(projectBrainChunks).values(
    chunks.map((chunk) => ({
      blockId,
      ord: chunk.ord,
      heading: chunk.heading,
      text: chunk.text,
      charCount: chunk.charCount,
    })),
  );
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

/** The slices of every document block in one query, so compiling a prompt does
 * not fan out one query per block. */
export async function listBrainChunks(
  blockIds: string[],
): Promise<BrainChunkRow[]> {
  if (!blockIds.length) return [];
  return getDb()
    .select()
    .from(projectBrainChunks)
    .where(inArray(projectBrainChunks.blockId, blockIds))
    .orderBy(asc(projectBrainChunks.blockId), asc(projectBrainChunks.ord));
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

  const body = input.body ?? "";
  const items = input.items ?? [];
  const rows = input.rows ?? null;
  const kind = input.kind ?? "note";

  const [row] = await db
    .insert(projectBrainBlocks)
    .values({
      projectId,
      title: input.title,
      kind,
      body,
      items,
      rows,
      digest: input.digest ?? "",
      usage: input.usage ?? "auto",
      tags: input.tags ?? [],
      sourceLabel: input.sourceLabel ?? "",
      sourceUrl: input.sourceUrl ?? "",
      charCount: contentCharCount({ body, items, rows }),
      inContext: (input.usage ?? "auto") !== "private",
      sortOrder: next,
    })
    .returning();
  await syncChunks(row.id, kind, body);
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
  if (input.rows !== undefined) patch.rows = input.rows;
  if (input.digest !== undefined) patch.digest = input.digest;
  if (input.tags !== undefined) patch.tags = input.tags;
  if (input.sourceLabel !== undefined) patch.sourceLabel = input.sourceLabel;
  if (input.sourceUrl !== undefined) patch.sourceUrl = input.sourceUrl;
  if (input.usage !== undefined) {
    patch.usage = input.usage;
    patch.inContext = input.usage !== "private";
  }

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
  if (!row) return null;

  // Recomputed from the saved row rather than the patch, because a patch that
  // changed only `items` still moves the count.
  const charCount = contentCharCount(row);
  if (charCount !== row.charCount) {
    await getDb()
      .update(projectBrainBlocks)
      .set({ charCount })
      .where(eq(projectBrainBlocks.id, row.id));
    row.charCount = charCount;
  }
  if (input.body !== undefined || input.kind !== undefined) {
    await syncChunks(row.id, row.kind, row.body);
  }
  await bumpProjectContext(projectId);
  return row;
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
