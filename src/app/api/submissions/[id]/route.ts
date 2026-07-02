import { auth } from "@clerk/nextjs/server";
import { and, eq, ne } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { submissions } from "@/lib/db/schema";
import { addStorageBytes } from "@/lib/db/users";
import { deleteObject } from "@/lib/r2";

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

/** Delete one of the user's own sessions: drop the R2 recording, free the
 * quota it held, and remove the row. This is the only way to reclaim storage,
 * so a user who fills their quota isn't permanently locked out. */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const db = getDb();
  const [row] = await db
    .select({ key: submissions.mediaKey, bytes: submissions.mediaBytes })
    .from(submissions)
    .where(and(eq(submissions.id, id), eq(submissions.userId, userId)))
    .limit(1);
  if (!row) return Response.json({ error: "not_found" }, { status: 404 });

  await db
    .delete(submissions)
    .where(and(eq(submissions.id, id), eq(submissions.userId, userId)));

  if (row.key) {
    // Only decrement / delete the object if no *other* row still references it
    // (the counter is charged once per object; deleting a duplicate must not
    // double-refund the quota or delete a still-referenced object).
    const [other] = await db
      .select({ id: submissions.id })
      .from(submissions)
      .where(and(eq(submissions.mediaKey, row.key), ne(submissions.id, id)))
      .limit(1);
    if (!other) {
      if (row.bytes) await addStorageBytes(userId, -row.bytes);
      try {
        await deleteObject(row.key);
      } catch {
        // a lifecycle sweep can reclaim it later
      }
    }
  }

  return Response.json({ ok: true });
}
