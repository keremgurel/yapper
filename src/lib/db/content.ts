import { and, desc, eq, sql } from "drizzle-orm";
import { getDb } from "./client";
import { contentItems, type ContentStatus } from "./schema";

/** Fields a client may set on a content item (everything else is server-owned). */
export interface ContentItemInput {
  title?: string;
  hooks?: string[];
  points?: string[];
  example?: string;
  cta?: string;
  script?: string | null;
  status?: ContentStatus;
  pillar?: string | null;
  scheduledFor?: Date | null;
  sourceUrl?: string | null;
  sourceTitle?: string | null;
  submissionId?: string | null;
}

export async function listContentItems(userId: string) {
  return getDb()
    .select({
      id: contentItems.id,
      title: contentItems.title,
      status: contentItems.status,
      scheduledFor: contentItems.scheduledFor,
      submissionId: contentItems.submissionId,
      pillar: contentItems.pillar,
      updatedAt: contentItems.updatedAt,
      createdAt: contentItems.createdAt,
    })
    .from(contentItems)
    .where(eq(contentItems.userId, userId))
    .orderBy(desc(contentItems.updatedAt))
    .limit(200);
}

export async function getContentItem(userId: string, id: string) {
  const [row] = await getDb()
    .select()
    .from(contentItems)
    .where(and(eq(contentItems.id, id), eq(contentItems.userId, userId)))
    .limit(1);
  return row ?? null;
}

export async function createContentItem(
  userId: string,
  input: ContentItemInput,
) {
  const [row] = await getDb()
    .insert(contentItems)
    .values({ userId, ...input })
    .returning();
  return row;
}

/** Partial update of the caller's own item. Returns the updated row, or null
 * when the item doesn't exist / isn't theirs. */
export async function updateContentItem(
  userId: string,
  id: string,
  input: ContentItemInput,
) {
  const [row] = await getDb()
    .update(contentItems)
    .set({ ...input, updatedAt: new Date() })
    .where(and(eq(contentItems.id, id), eq(contentItems.userId, userId)))
    .returning();
  return row ?? null;
}

export async function deleteContentItem(
  userId: string,
  id: string,
): Promise<boolean> {
  const rows = await getDb()
    .delete(contentItems)
    .where(and(eq(contentItems.id, id), eq(contentItems.userId, userId)))
    .returning({ id: contentItems.id });
  return rows.length > 0;
}

export interface ImportItem extends ContentItemInput {
  /** The original localStorage id; unique per user, so re-runs are no-ops. */
  sourceClientId: string;
  /** Original timestamps, so imported items keep their ordering. */
  createdAt?: Date;
  updatedAt?: Date;
}

/** One-shot batch import of localStorage ideas. One transaction; conflicts on
 * (userId, sourceClientId) are skipped, so a retried import can't duplicate.
 * Returns how many rows were actually inserted. */
export async function importContentItems(
  userId: string,
  items: ImportItem[],
): Promise<number> {
  if (items.length === 0) return 0;
  const inserted = await getDb()
    .insert(contentItems)
    .values(items.map((item) => ({ userId, ...item })))
    .onConflictDoNothing({
      target: [contentItems.userId, contentItems.sourceClientId],
    })
    .returning({ id: contentItems.id });
  return inserted.length;
}

/** Link (or unlink) the latest recording of an item. Scoped to the owner. */
export async function setContentSubmission(
  userId: string,
  id: string,
  submissionId: string | null,
): Promise<boolean> {
  const rows = await getDb()
    .update(contentItems)
    .set({ submissionId, updatedAt: sql`now()` })
    .where(and(eq(contentItems.id, id), eq(contentItems.userId, userId)))
    .returning({ id: contentItems.id });
  return rows.length > 0;
}
