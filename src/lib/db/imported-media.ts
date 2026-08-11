import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "./client";
import { importedPlatformMedia, type PublishPlatform } from "./schema";

/**
 * The record of platform posts whose video file has already been pulled into
 * the creator's storage.
 *
 * Recovering that file costs a metered lookup at a third party, so it is worth
 * remembering. Everything here exists so the same post is never paid for twice.
 */

/** The stored file for one post, or null if it has never been imported. */
export async function importedMediaForPost(
  userId: string,
  platform: PublishPlatform,
  externalPostId: string,
): Promise<{ mediaKey: string; title: string | null } | null> {
  const [row] = await getDb()
    .select({
      mediaKey: importedPlatformMedia.mediaKey,
      title: importedPlatformMedia.title,
    })
    .from(importedPlatformMedia)
    .where(
      and(
        eq(importedPlatformMedia.userId, userId),
        eq(importedPlatformMedia.platform, platform),
        eq(importedPlatformMedia.externalPostId, externalPostId),
      ),
    );
  return row ?? null;
}

/** The stored files for a page of posts, keyed by the platform's post id. */
export async function importedMediaKeysForPosts(
  userId: string,
  platform: PublishPlatform,
  externalPostIds: string[],
): Promise<Map<string, string>> {
  if (externalPostIds.length === 0) return new Map();
  const rows = await getDb()
    .select({
      externalPostId: importedPlatformMedia.externalPostId,
      mediaKey: importedPlatformMedia.mediaKey,
    })
    .from(importedPlatformMedia)
    .where(
      and(
        eq(importedPlatformMedia.userId, userId),
        eq(importedPlatformMedia.platform, platform),
        inArray(importedPlatformMedia.externalPostId, externalPostIds),
      ),
    );
  return new Map(rows.map((row) => [row.externalPostId, row.mediaKey]));
}

/**
 * Remember the file imported for one post. Re-importing overwrites in place:
 * the newer object is the one that exists in storage, and the unique index on
 * (user, platform, post) keeps a post from accumulating rows.
 */
export async function recordImportedMedia(
  userId: string,
  platform: PublishPlatform,
  externalPostId: string,
  mediaKey: string,
  title: string,
): Promise<void> {
  await getDb()
    .insert(importedPlatformMedia)
    .values({ userId, platform, externalPostId, mediaKey, title })
    .onConflictDoUpdate({
      target: [
        importedPlatformMedia.userId,
        importedPlatformMedia.platform,
        importedPlatformMedia.externalPostId,
      ],
      set: { mediaKey, title },
    });
}
