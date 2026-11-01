import { auth } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { submissions } from "@/lib/db/schema";
import { refusalResponse } from "@/lib/http/operation-result";
import { deleteSubmission } from "@/lib/submissions/operations/delete-submission";

export const runtime = "nodejs";

/** Full detail for one of the user's own submissions (feedback + transcript). */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const [row] = await getDb()
    .select()
    .from(submissions)
    .where(and(eq(submissions.id, id), eq(submissions.userId, userId)))
    .limit(1);

  if (!row) return Response.json({ error: "not_found" }, { status: 404 });
  return Response.json({ submission: row });
}

/** Delete one of the user's own sessions, through the same operation as
 * Chirpy's studio.storage.deleteRecording. */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const removed = await deleteSubmission(userId, id);
  if (!removed.ok) return refusalResponse(removed);
  return Response.json({ ok: true });
}
