import { and, eq, ne, sql } from "drizzle-orm";
import { getDb, type DbTx } from "./client";
import { submissions, users } from "./schema";

/**
 * Count a stored recording against the user's quota exactly once per object:
 * if any OTHER submission already references this mediaKey, the object was
 * already counted and this is a no-op. (The symmetric decrement lives in the
 * submission DELETE route, which only refunds when no other row references
 * the key.) Shared by the feedback pipeline and feedback-less saves.
 */
export async function countMediaOnce(
  userId: string,
  mediaKey: string,
  bytes: number,
  excludeSubmissionId: string,
): Promise<void> {
  return getDb().transaction((tx) =>
    countMediaOnceWithinTx(tx, userId, mediaKey, bytes, excludeSubmissionId),
  );
}

/** Transactional form used when storage registration is one part of a larger
 * atomic completion. The duplicate lookup is user-scoped: object namespaces
 * are per user, but accounting must not rely on that convention alone. */
export async function countMediaOnceWithinTx(
  tx: DbTx,
  userId: string,
  mediaKey: string,
  bytes: number,
  excludeSubmissionId: string,
): Promise<void> {
  if (bytes <= 0) return;

  // Serialize registration for this user's object. Without this lock, two
  // concurrent completions can both observe no duplicate and increment the
  // counter twice. The lock is released automatically with the transaction.
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(${`${userId}:${mediaKey}`}, 0))`,
  );

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

  const updated = await tx
    .update(users)
    .set({ storageBytes: sql`greatest(0, ${users.storageBytes} + ${bytes})` })
    .where(eq(users.id, userId))
    .returning({ id: users.id });
  if (updated.length === 0) throw new Error("user not found");
}
