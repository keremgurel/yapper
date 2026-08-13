import { and, eq, ne, sql } from "drizzle-orm";
import { type DbTx } from "./client";
import { importedPlatformMedia, submissions, users } from "./schema";

export class StorageQuotaError extends Error {
  constructor() {
    super("storage_full");
    this.name = "StorageQuotaError";
  }
}

/** Serialize changes to one user's aggregate storage counter. This is always
 * the first accounting lock; object locks and the users row follow it. */
export async function lockStorageUserWithinTx(
  tx: DbTx,
  userId: string,
): Promise<void> {
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(${`storage-user:${userId}`}, 0))`,
  );
}

/** Serialize every accounting decision for one user-owned object. */
export async function lockMediaReferenceWithinTx(
  tx: DbTx,
  userId: string,
  mediaKey: string,
): Promise<void> {
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(${`${userId}:${mediaKey}`}, 0))`,
  );
}

/**
 * Count a stored recording against the user's quota exactly once per object:
 * if any OTHER submission already references this mediaKey, the object was
 * already counted and this is a no-op. (The symmetric decrement lives in the
 * submission DELETE route, which only refunds when no other row references
 * the key.) Shared by the feedback pipeline and feedback-less saves.
 */
/** Transactional form used when storage registration is one part of a larger
 * atomic completion. The duplicate lookup is user-scoped: object namespaces
 * are per user, but accounting must not rely on that convention alone. */
export async function countMediaOnceWithinTx(
  tx: DbTx,
  userId: string,
  mediaKey: string,
  bytes: number,
  excludeSubmissionId: string,
  quotaBytes: number,
): Promise<void> {
  if (bytes <= 0) return;

  await lockStorageUserWithinTx(tx, userId);
  // Serialize registration for this user's object. Without this lock, two
  // concurrent completions can both observe no duplicate and increment the
  // counter twice. The lock is released automatically with the transaction.
  await lockMediaReferenceWithinTx(tx, userId, mediaKey);

  const [dup] = await tx
    .select({ id: submissions.id })
    .from(submissions)
    .where(
      and(
        eq(submissions.userId, userId),
        eq(submissions.mediaKey, mediaKey),
        ne(submissions.id, excludeSubmissionId),
      ),
    )
    .limit(1);
  if (dup) return;

  // Imported platform media is another durable reference to the same object.
  // Registering it already charged the bytes, so saving/analysing that clip as
  // a submission must not charge the user a second time.
  const [imported] = await tx
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
    )
    .limit(1);
  if (imported?.mediaBytes && imported.mediaBytes > 0) return;

  const updated = await tx
    .update(users)
    .set({ storageBytes: sql`greatest(0, ${users.storageBytes} + ${bytes})` })
    .where(
      and(
        eq(users.id, userId),
        sql`${users.storageBytes} + ${bytes} <= ${quotaBytes}`,
      ),
    )
    .returning({ id: users.id });
  if (updated.length === 0) {
    throw new StorageQuotaError();
  }

  // A zero-byte import is a row from before imported objects participated in
  // accounting. No other submission exists (the duplicate check above), so
  // this transaction becomes the first owner and records that transfer on the
  // import row to prevent a later cache reconciliation from double-counting.
  if (imported) {
    await tx
      .update(importedPlatformMedia)
      .set({ mediaBytes: bytes })
      .where(eq(importedPlatformMedia.id, imported.id));
  }
}
