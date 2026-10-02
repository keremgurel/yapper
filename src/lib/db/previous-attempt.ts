import { and, desc, eq, lt, ne, sql } from "drizzle-orm";
import type { TrainingFeedbackRecord } from "@/lib/training-feedback/types";
import { getDb } from "./client";
import { submissions } from "./schema";

export interface PreviousAttempt {
  id: string;
  createdAt: string;
  feedback: TrainingFeedbackRecord;
}

/**
 * The user's most recent earlier scored attempt at the same prompt, so a
 * report can show what changed. Null when this is their first try at it.
 */
export async function findPreviousAttempt(
  userId: string,
  submissionId: string,
): Promise<PreviousAttempt | null> {
  const db = getDb();
  const [current] = await db
    .select({ context: submissions.context, createdAt: submissions.createdAt })
    .from(submissions)
    .where(
      and(
        eq(submissions.id, submissionId),
        eq(submissions.userId, userId),
        eq(submissions.surface, "training"),
      ),
    )
    .limit(1);
  const prompt = (current?.context as { prompt?: unknown } | null)?.prompt;
  if (!current || typeof prompt !== "string" || !prompt) return null;

  const [row] = await db
    .select({
      id: submissions.id,
      createdAt: submissions.createdAt,
      feedback: submissions.feedback,
    })
    .from(submissions)
    .where(
      and(
        eq(submissions.userId, userId),
        eq(submissions.surface, "training"),
        eq(submissions.status, "complete"),
        ne(submissions.id, submissionId),
        lt(submissions.createdAt, current.createdAt),
        sql`${submissions.context}->>'prompt' = ${prompt}`,
      ),
    )
    .orderBy(desc(submissions.createdAt))
    .limit(1);
  if (!row?.feedback) return null;
  return {
    id: row.id,
    createdAt: row.createdAt.toISOString(),
    feedback: row.feedback as TrainingFeedbackRecord,
  };
}
