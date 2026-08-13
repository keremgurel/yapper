import { and, eq, sql } from "drizzle-orm";
import { getDb, type DbTx } from "./client";
import {
  lockMediaReferenceWithinTx,
  lockStorageUserWithinTx,
} from "./storage-accounting";
import {
  activateObjectWithinTx,
  markObjectMissingWithinTx,
} from "./r2-lifecycle";
import {
  importedPlatformMedia,
  submissions,
  users,
  type PublishPlatform,
} from "./schema";

/**
 * The record of platform posts whose video file has already been pulled into
 * the creator's storage. Every row is also a durable storage reference: its
 * byte count participates in the user's quota and protects the object while a
 * submission points at the same key.
 */

export interface ImportedMediaRecord {
  mediaKey: string;
  mediaBytes: number;
  title: string | null;
}

export class ImportedMediaQuotaError extends Error {
  constructor() {
    super("storage quota exceeded");
    this.name = "ImportedMediaQuotaError";
  }
}

async function lockImportedMediaUser(tx: DbTx, userId: string): Promise<void> {
  // Quota is a per-user total, so registrations for different posts must share
  // one lock. A per-object lock would still let two clips both spend the last
  // available bytes after observing the same counter.
  await lockStorageUserWithinTx(tx, userId);
}

/** The stored file for one post, or null if it has never been imported. */
export async function importedMediaForPost(
  userId: string,
  platform: PublishPlatform,
  externalPostId: string,
): Promise<ImportedMediaRecord | null> {
  const [row] = await getDb()
    .select({
      mediaKey: importedPlatformMedia.mediaKey,
      mediaBytes: importedPlatformMedia.mediaBytes,
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

export type ImportedMediaRegistration =
  | ({ kind: "inserted" } & ImportedMediaRecord)
  | ({ kind: "existing" } & ImportedMediaRecord);

/**
 * Atomically claim one imported object and its quota bytes.
 *
 * The caller uploads to a unique attempt key first. Inside one user advisory
 * lock we re-check the post cache, conditionally increment the quota counter,
 * and insert the durable reference. A losing concurrent attempt therefore
 * never increments storage and can delete only its own unique object.
 */
export async function registerImportedMedia(
  userId: string,
  platform: PublishPlatform,
  externalPostId: string,
  mediaKey: string,
  mediaBytes: number,
  title: string,
  quotaBytes: number,
): Promise<ImportedMediaRegistration> {
  if (!Number.isSafeInteger(mediaBytes) || mediaBytes <= 0) {
    throw new Error("invalid imported media size");
  }

  return getDb().transaction(async (tx) => {
    await lockImportedMediaUser(tx, userId);

    const [existing] = await tx
      .select({
        mediaKey: importedPlatformMedia.mediaKey,
        mediaBytes: importedPlatformMedia.mediaBytes,
        title: importedPlatformMedia.title,
      })
      .from(importedPlatformMedia)
      .where(
        and(
          eq(importedPlatformMedia.userId, userId),
          eq(importedPlatformMedia.platform, platform),
          eq(importedPlatformMedia.externalPostId, externalPostId),
        ),
      )
      .limit(1);
    if (existing) return { kind: "existing", ...existing };

    const updated = await tx
      .update(users)
      .set({ storageBytes: sql`${users.storageBytes} + ${mediaBytes}` })
      .where(
        and(
          eq(users.id, userId),
          sql`${users.storageBytes} + ${mediaBytes} <= ${quotaBytes}`,
        ),
      )
      .returning({ id: users.id });
    if (updated.length === 0) throw new ImportedMediaQuotaError();

    await tx.insert(importedPlatformMedia).values({
      userId,
      platform,
      externalPostId,
      mediaKey,
      mediaBytes,
      title,
    });
    await activateObjectWithinTx(tx, userId, mediaKey, mediaBytes, "import");
    return {
      kind: "inserted",
      mediaKey,
      mediaBytes,
      title,
    };
  });
}

/**
 * Remove a cache row only when it still names the exact object the caller
 * inspected. Missing-object reconciliation uses this to avoid racing a fresh
 * import. Storage is refunded only when no submission or other import still
 * references the key.
 */
export async function invalidateMissingImportedMedia(
  userId: string,
  platform: PublishPlatform,
  externalPostId: string,
  mediaKey: string,
): Promise<boolean> {
  return getDb().transaction(async (tx) => {
    await lockImportedMediaUser(tx, userId);
    await lockMediaReferenceWithinTx(tx, userId, mediaKey);
    const [row] = await tx
      .select({
        id: importedPlatformMedia.id,
        mediaBytes: importedPlatformMedia.mediaBytes,
      })
      .from(importedPlatformMedia)
      .where(
        and(
          eq(importedPlatformMedia.userId, userId),
          eq(importedPlatformMedia.platform, platform),
          eq(importedPlatformMedia.externalPostId, externalPostId),
          eq(importedPlatformMedia.mediaKey, mediaKey),
        ),
      )
      .limit(1);
    if (!row) return false;

    const importedRows = await tx
      .select({
        id: importedPlatformMedia.id,
        mediaBytes: importedPlatformMedia.mediaBytes,
      })
      .from(importedPlatformMedia)
      .where(
        and(
          eq(importedPlatformMedia.userId, userId),
          eq(importedPlatformMedia.mediaKey, mediaKey),
        ),
      );
    const submissionRows = await tx
      .select({ mediaBytes: submissions.mediaBytes })
      .from(submissions)
      .where(
        and(eq(submissions.userId, userId), eq(submissions.mediaKey, mediaKey)),
      );

    // HeadObject proved the object does not exist. Preserve no dead reference:
    // invalidate every exact-key owner and refund the one physical object once.
    await tx
      .delete(importedPlatformMedia)
      .where(
        and(
          eq(importedPlatformMedia.userId, userId),
          eq(importedPlatformMedia.mediaKey, mediaKey),
        ),
      );
    await tx
      .update(submissions)
      .set({ mediaKey: null, mediaBytes: 0, updatedAt: new Date() })
      .where(
        and(eq(submissions.userId, userId), eq(submissions.mediaKey, mediaKey)),
      );

    const accountedBytes = Math.max(
      0,
      ...importedRows.map((candidate) => candidate.mediaBytes),
      ...submissionRows.map((candidate) => candidate.mediaBytes),
    );
    if (accountedBytes > 0) {
      await tx
        .update(users)
        .set({
          storageBytes: sql`greatest(0, ${users.storageBytes} - ${accountedBytes})`,
        })
        .where(eq(users.id, userId));
    }
    await markObjectMissingWithinTx(
      tx,
      userId,
      mediaKey,
      "head_object_missing",
    );
    return true;
  });
}

/**
 * Backfill a legacy cache row created before imported objects stored their byte
 * count. If a submission already references the same key, that object was
 * already counted; otherwise the backfill must fit under today's quota.
 */
export async function reconcileImportedMediaBytes(
  userId: string,
  platform: PublishPlatform,
  externalPostId: string,
  mediaKey: string,
  mediaBytes: number,
  quotaBytes: number,
): Promise<ImportedMediaRecord | null> {
  return getDb().transaction(async (tx) => {
    await lockImportedMediaUser(tx, userId);
    await lockMediaReferenceWithinTx(tx, userId, mediaKey);
    const [row] = await tx
      .select({
        id: importedPlatformMedia.id,
        mediaKey: importedPlatformMedia.mediaKey,
        mediaBytes: importedPlatformMedia.mediaBytes,
        title: importedPlatformMedia.title,
      })
      .from(importedPlatformMedia)
      .where(
        and(
          eq(importedPlatformMedia.userId, userId),
          eq(importedPlatformMedia.platform, platform),
          eq(importedPlatformMedia.externalPostId, externalPostId),
          eq(importedPlatformMedia.mediaKey, mediaKey),
        ),
      )
      .limit(1);
    if (!row) return null;
    if (row.mediaBytes === mediaBytes) {
      await activateObjectWithinTx(tx, userId, mediaKey, mediaBytes, "import");
      return row;
    }

    const [submission] = await tx
      .select({ id: submissions.id })
      .from(submissions)
      .where(
        and(eq(submissions.userId, userId), eq(submissions.mediaKey, mediaKey)),
      )
      .limit(1);

    // A non-zero imported value means this row owns the accounting. A zero
    // legacy value owns it only when no submission already counted the object.
    const delta =
      row.mediaBytes > 0
        ? mediaBytes - row.mediaBytes
        : submission
          ? 0
          : mediaBytes;
    if (delta > 0) {
      const updated = await tx
        .update(users)
        .set({ storageBytes: sql`${users.storageBytes} + ${delta}` })
        .where(
          and(
            eq(users.id, userId),
            sql`${users.storageBytes} + ${delta} <= ${quotaBytes}`,
          ),
        )
        .returning({ id: users.id });
      if (updated.length === 0) throw new ImportedMediaQuotaError();
    } else if (delta < 0) {
      await tx
        .update(users)
        .set({
          storageBytes: sql`greatest(0, ${users.storageBytes} + ${delta})`,
        })
        .where(eq(users.id, userId));
    }

    await tx
      .update(importedPlatformMedia)
      .set({ mediaBytes })
      .where(eq(importedPlatformMedia.id, row.id));
    await activateObjectWithinTx(tx, userId, mediaKey, mediaBytes, "import");
    return { mediaKey, mediaBytes, title: row.title };
  });
}
