import { and, eq } from "drizzle-orm";
import { getDb } from "./client";
import { submissions } from "./schema";

/** The R2 media key of one of the user's OWN submissions, or null. Scoped by
 * userId in the query, so a caller can never resolve someone else's media. */
export async function getOwnedMediaKey(
  userId: string,
  submissionId: string,
): Promise<string | null> {
  const [row] = await getDb()
    .select({ mediaKey: submissions.mediaKey })
    .from(submissions)
    .where(
      and(eq(submissions.id, submissionId), eq(submissions.userId, userId)),
    );
  return row?.mediaKey ?? null;
}
