import { and, eq, ne } from "drizzle-orm";
import { getDb } from "./client";
import { submissions } from "./schema";
import { addStorageBytes } from "./users";

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
  if (bytes <= 0) return;
  const [dup] = await getDb()
    .select({ id: submissions.id })
    .from(submissions)
    .where(
      and(
        eq(submissions.mediaKey, mediaKey),
        ne(submissions.id, excludeSubmissionId),
      ),
    )
    .limit(1);
  if (!dup) await addStorageBytes(userId, bytes);
}
