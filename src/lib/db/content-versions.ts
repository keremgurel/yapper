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

/**
 * Creates the version or merges into it. Null when the idea isn't theirs.
 * `reconcile` sees the locked row (null when there is none yet) and returns
 * the input to write, or throws ContentConflict to write nothing.
 */
export async function saveContentVersion(
  userId: string,
  itemId: string,
  format: VersionFormat,
  requested: ContentVersionInput,
  reconcile?: (current: ContentVersionRow | null) => ContentVersionInput,
): Promise<ContentVersionRow | null> {
  if (!(await ownsItem(userId, itemId))) return null;
  return getDb().transaction(async (tx) => {
    const now = new Date();
    // The idea's row is locked first, so two saves of one version queue
    // even while the version row does not exist yet. Its timestamp moves
    // too, so the list shows the idea as touched.
    await tx
      .update(contentItems)
      .set({ updatedAt: now })
      .where(eq(contentItems.id, itemId));
    const [current] = await tx
      .select()
      .from(contentVersions)
      .where(
        and(
          eq(contentVersions.contentItemId, itemId),
          eq(contentVersions.format, format),
        ),
      )
      .for("update")
      .limit(1);
    const input = reconcile ? reconcile(current ?? null) : requested;
    const [row] = await tx
      .insert(contentVersions)
      .values({ contentItemId: itemId, format, ...input, updatedAt: now })
      .onConflictDoUpdate({
        target: [contentVersions.contentItemId, contentVersions.format],
        set: { ...input, updatedAt: now },
      })
      .returning();
    return row ?? null;
  });
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
