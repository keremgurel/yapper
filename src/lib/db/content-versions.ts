import { and, asc, eq } from "drizzle-orm";
import type { VersionFormat } from "@/lib/content/formats";
import type { ContentVersionInput } from "@/lib/content/version-input";
import { getDb } from "./client";
import { contentItems, contentVersions } from "./schema";

export type ContentVersionRow = typeof contentVersions.$inferSelect;

/**
 * The non-lead versions of one idea. Every function takes the user id and
 * checks the idea is theirs first, so a version can never be read or written
 * through someone else's idea id.
 */

async function ownsItem(userId: string, itemId: string): Promise<boolean> {
  const [row] = await getDb()
    .select({ id: contentItems.id })
    .from(contentItems)
    .where(and(eq(contentItems.id, itemId), eq(contentItems.userId, userId)))
    .limit(1);
  return Boolean(row);
}

export async function listContentVersions(
  userId: string,
  itemId: string,
): Promise<ContentVersionRow[]> {
  if (!(await ownsItem(userId, itemId))) return [];
  return getDb()
    .select()
    .from(contentVersions)
    .where(eq(contentVersions.contentItemId, itemId))
    .orderBy(asc(contentVersions.createdAt));
}

/** Creates the version or merges into it. Null when the idea isn't theirs. */
export async function saveContentVersion(
  userId: string,
  itemId: string,
  format: VersionFormat,
  input: ContentVersionInput,
): Promise<ContentVersionRow | null> {
  if (!(await ownsItem(userId, itemId))) return null;
  const now = new Date();
  const [row] = await getDb()
    .insert(contentVersions)
    .values({ contentItemId: itemId, format, ...input, updatedAt: now })
    .onConflictDoUpdate({
      target: [contentVersions.contentItemId, contentVersions.format],
      set: { ...input, updatedAt: now },
    })
    .returning();
  // The idea's own timestamp moves too, so the list shows it as touched.
  await getDb()
    .update(contentItems)
    .set({ updatedAt: now })
    .where(eq(contentItems.id, itemId));
  return row ?? null;
}

/** True when a version was removed. */
export async function deleteContentVersion(
  userId: string,
  itemId: string,
  format: VersionFormat,
): Promise<boolean> {
  if (!(await ownsItem(userId, itemId))) return false;
  const removed = await getDb()
    .delete(contentVersions)
    .where(
      and(
        eq(contentVersions.contentItemId, itemId),
        eq(contentVersions.format, format),
      ),
    )
    .returning({ id: contentVersions.id });
  return removed.length > 0;
}
