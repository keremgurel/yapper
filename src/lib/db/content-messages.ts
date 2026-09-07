import { and, asc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import {
  contentItems,
  contentMessages,
  type ContentMessageRole,
} from "@/lib/db/schema";

export type ContentMessageRow = typeof contentMessages.$inferSelect;

/** How much of a thread a page loads and a prompt sees. */
export const THREAD_PAGE = 60;
export const THREAD_CONTEXT = 12;

/**
 * The conversation on one idea, oldest first. Ownership rides on the item:
 * a message row is only ever reached through an item the caller owns.
 */
export async function listContentMessages(
  userId: string,
  contentItemId: string,
  limit = THREAD_PAGE,
): Promise<ContentMessageRow[]> {
  const rows = await getDb()
    .select({ message: contentMessages })
    .from(contentMessages)
    .innerJoin(contentItems, eq(contentItems.id, contentMessages.contentItemId))
    .where(
      and(
        eq(contentMessages.contentItemId, contentItemId),
        eq(contentItems.userId, userId),
      ),
    )
    .orderBy(asc(contentMessages.createdAt), asc(contentMessages.id))
    .limit(limit);
  return rows.map((row) => row.message);
}

/** Appends lines to a thread in order. The item must be the caller's. */
export async function appendContentMessages(
  userId: string,
  contentItemId: string,
  lines: { role: ContentMessageRole; text: string; actions?: unknown[] }[],
): Promise<ContentMessageRow[]> {
  if (lines.length === 0) return [];
  const db = getDb();
  const [owned] = await db
    .select({ id: contentItems.id })
    .from(contentItems)
    .where(
      and(eq(contentItems.id, contentItemId), eq(contentItems.userId, userId)),
    );
  if (!owned) throw new Error("content_not_owned");
  // Stamped one millisecond apart so the thread reads back in the order the
  // lines were given: a database default would give both lines of one
  // exchange the same instant, and ids are random.
  const base = Date.now();
  const rows = await db
    .insert(contentMessages)
    .values(
      lines.map((line, index) => ({
        contentItemId,
        userId,
        role: line.role,
        text: line.text.slice(0, 8000),
        actions: line.actions ?? [],
        createdAt: new Date(base + index),
      })),
    )
    .returning();
  return [...rows].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
  );
}

export async function clearContentMessages(
  userId: string,
  contentItemId: string,
): Promise<void> {
  const db = getDb();
  const [owned] = await db
    .select({ id: contentItems.id })
    .from(contentItems)
    .where(
      and(eq(contentItems.id, contentItemId), eq(contentItems.userId, userId)),
    );
  if (!owned) return;
  await db
    .delete(contentMessages)
    .where(eq(contentMessages.contentItemId, contentItemId));
}
