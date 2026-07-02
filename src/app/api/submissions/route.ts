import { auth } from "@clerk/nextjs/server";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { submissions } from "@/lib/db/schema";

export const runtime = "nodejs";

/** List the signed-in user's submissions for the history view (summaries only). */
export async function GET(): Promise<Response> {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const rows = await getDb()
    .select({
      id: submissions.id,
      kind: submissions.kind,
      status: submissions.status,
      creditsCost: submissions.creditsCost,
      durationSec: submissions.durationSec,
      scores: submissions.scores,
      createdAt: submissions.createdAt,
    })
    .from(submissions)
    .where(eq(submissions.userId, userId))
    .orderBy(desc(submissions.createdAt))
    .limit(50);

  return Response.json({ submissions: rows });
}
