import { and, count, eq, gte } from "drizzle-orm";
import { fairUseDayStart } from "@/lib/billing/train-fair-use";
import { getDb } from "./client";
import { submissions } from "./schema";

/** Completed Train feedback sessions for this user in the current UTC day. */
export async function countTrainSessionsToday(
  userId: string,
  now: Date = new Date(),
): Promise<number> {
  const [row] = await getDb()
    .select({ sessions: count() })
    .from(submissions)
    .where(
      and(
        eq(submissions.userId, userId),
        eq(submissions.surface, "training"),
        eq(submissions.status, "complete"),
        gte(submissions.createdAt, fairUseDayStart(now)),
      ),
    );
  return row?.sessions ?? 0;
}
