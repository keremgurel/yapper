import { and, eq, sql } from "drizzle-orm";
import type { PronunciationReport } from "@/lib/pronunciation/types";
import { getDb } from "./client";
import { submissions } from "./schema";

/**
 * Attach pronunciation scores to a finished training session the user owns.
 * Written once: a session that already has them is left alone. Returns whether
 * a row changed.
 */
export async function attachPronunciation(
  userId: string,
  submissionId: string,
  report: PronunciationReport,
): Promise<boolean> {
  const changed = await getDb()
    .update(submissions)
    .set({
      feedback: sql`jsonb_set(${submissions.feedback}, '{pronunciation}', ${JSON.stringify(report)}::jsonb)`,
    })
    .where(
      and(
        eq(submissions.id, submissionId),
        eq(submissions.userId, userId),
        eq(submissions.surface, "training"),
        eq(submissions.status, "complete"),
        sql`${submissions.feedback} is not null`,
        sql`${submissions.feedback}->'pronunciation' is null`,
      ),
    )
    .returning({ id: submissions.id });
  return changed.length > 0;
}
