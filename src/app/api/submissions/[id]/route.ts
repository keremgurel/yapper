import { auth } from "@clerk/nextjs/server";
import { and, eq, ne, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { importedPlatformMedia, submissions, users } from "@/lib/db/schema";
import {
  lockMediaReferenceWithinTx,
  lockStorageUserWithinTx,
} from "@/lib/db/storage-accounting";
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
  const outcome = await db.transaction(async (tx) => {
    await lockStorageUserWithinTx(tx, userId);
    const [candidate] = await tx
      .select({ key: submissions.mediaKey, bytes: submissions.mediaBytes })
      .from(submissions)
      .where(and(eq(submissions.id, id), eq(submissions.userId, userId)))
      .limit(1);
    if (!candidate) return null;

    if (candidate.key) {
      await lockMediaReferenceWithinTx(tx, userId, candidate.key);
    }

    // Waiting for the advisory lock may have allowed another request to delete
    // this row. Re-read it under the lock so stale bytes cannot be refunded or
    // the same object deleted twice.
    const [row] = await tx
      .select({ key: submissions.mediaKey, bytes: submissions.mediaBytes })
      .from(submissions)
      .where(and(eq(submissions.id, id), eq(submissions.userId, userId)))
      .limit(1);
    if (!row) return null;
    if (row.key !== candidate.key) {
      throw new Error("submission media changed during deletion");
    }

    await tx
      .delete(submissions)
      .where(and(eq(submissions.id, id), eq(submissions.userId, userId)));

    if (!row.key) return { deleteKey: null };
    const [otherSubmission] = await tx
      .select({ id: submissions.id })
      .from(submissions)
      .where(
        and(
          eq(submissions.userId, userId),
          eq(submissions.mediaKey, row.key),
          ne(submissions.id, id),
        ),
      )
      .limit(1);
    const [imported] = await tx
      .select({
        id: importedPlatformMedia.id,
        mediaBytes: importedPlatformMedia.mediaBytes,
      })
      .from(importedPlatformMedia)
      .where(
        and(
          eq(importedPlatformMedia.userId, userId),
          eq(importedPlatformMedia.mediaKey, row.key),
        ),
      )
      .limit(1);
    if (otherSubmission) return { deleteKey: null };
    if (imported) {
      // Migration gives old import rows a zero byte count. When their last
      // submission disappears, transfer accounting ownership to the import row
      // without touching the already-counted user total; otherwise a later
      // cache reconciliation would add the same bytes a second time.
      if (imported.mediaBytes === 0 && row.bytes > 0) {
        await tx
          .update(importedPlatformMedia)
          .set({ mediaBytes: row.bytes })
          .where(eq(importedPlatformMedia.id, imported.id));
      }
      return { deleteKey: null };
    }

    if (row.bytes > 0) {
      await tx
        .update(users)
        .set({
          storageBytes: sql`greatest(0, ${users.storageBytes} - ${row.bytes})`,
        })
        .where(eq(users.id, userId));
    }
    return { deleteKey: row.key };
  });
  if (!outcome) return Response.json({ error: "not_found" }, { status: 404 });

  if (outcome.deleteKey) {
    try {
      await deleteObject(outcome.deleteKey);
    } catch {
      // a lifecycle sweep can reclaim it later
    }
  }

  return Response.json({ ok: true });
}
