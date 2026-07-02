import { and, eq, lt } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { refundCredits } from "@/lib/db/credits";
import { submissions } from "@/lib/db/schema";

// A feedback request runs inline; if the function is killed (timeout, OOM,
// instance recycle) after the credit is deducted but before the result is
// stored, the submission is stranded in "processing" and the credit isn't
// refunded. This sweep is the backstop: anything stuck past the TTL gets
// refunded (idempotently) and marked failed.
const STUCK_TTL_MS = 5 * 60 * 1000;

export async function reconcileStuckSubmissions(): Promise<number> {
  const db = getDb();
  const cutoff = new Date(Date.now() - STUCK_TTL_MS);

  const stuck = await db
    .select({
      id: submissions.id,
      userId: submissions.userId,
      creditsCost: submissions.creditsCost,
    })
    .from(submissions)
    .where(
      and(
        eq(submissions.status, "processing"),
        lt(submissions.createdAt, cutoff),
      ),
    );

  for (const s of stuck) {
    if (s.creditsCost > 0) {
      await refundCredits(s.userId, s.creditsCost, s.id); // idempotent
    }
    await db
      .update(submissions)
      .set({ status: "failed", error: "timed_out", updatedAt: new Date() })
      .where(eq(submissions.id, s.id));
  }

  return stuck.length;
}
