import { auth } from "@clerk/nextjs/server";
import { and, desc, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { getDb } from "@/lib/db/client";
import { MAX_DIRECT_VIDEO_UPLOAD_BYTES } from "@/lib/db/constants";
import { importedPlatformMedia, submissions } from "@/lib/db/schema";
import { activateObjectWithinTx } from "@/lib/db/r2-lifecycle";
import {
  countMediaOnceWithinTx,
  lockMediaReferenceWithinTx,
  lockStorageUserWithinTx,
  StorageQuotaError,
} from "@/lib/db/storage-accounting";
import { ensureUser, getStorageBytes } from "@/lib/db/users";
import { canUsePremium } from "@/lib/billing/gate";
import { getStorageQuota } from "@/lib/db/billing";
import { headObjectBytes, ownsKey } from "@/lib/r2";

export const runtime = "nodejs";

/**
 * List the signed-in user's Studio submissions for the history view
 * (summaries only).
 *
 * Scoped to `surface = 'studio'` deliberately. Training reps live in the same
 * table but carry a different feedback shape (five scored dimensions and an
 * overview, not a single score and a summary), and the history view renders
 * every row through the Studio feedback component. Training reps have their
 * own list at /api/training/progress and their own report screen.
 */
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
    .where(
      and(eq(submissions.userId, userId), eq(submissions.surface, "studio")),
    )
    .orderBy(desc(submissions.createdAt))
    .limit(50);

  return Response.json({ submissions: rows });
}

/**
 * Register an uploaded recording as a submission WITHOUT running feedback
 * ("save this take"): the client presign-PUTs to R2 first (/api/media/upload-url),
 * then posts the mediaKey here. The claimed size is never trusted: we HeadObject
 * for the actual bytes, enforce the direct-upload cap and storage quota on them,
 * and count the object against the quota once (shared dedupe with the feedback
 * pipeline). Premium-gated like the rest of the library surface.
 */
export async function POST(req: NextRequest): Promise<Response> {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  await ensureUser(userId);
  if (!(await canUsePremium(userId))) {
    return Response.json({ error: "not_entitled" }, { status: 402 });
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const mediaKey = typeof body.mediaKey === "string" ? body.mediaKey : "";
  if (!mediaKey || !ownsKey(userId, mediaKey)) {
    return Response.json({ error: "bad_media" }, { status: 400 });
  }
  const title =
    typeof body.title === "string" ? body.title.slice(0, 300) : null;
  const durationSec =
    typeof body.durationSec === "number" &&
    Number.isFinite(body.durationSec) &&
    body.durationSec > 0
      ? Math.min(body.durationSec, 7200)
      : null;

  // The object must actually exist; its real size is the accounting truth.
  const bytes = await headObjectBytes(mediaKey);
  if (bytes === null) {
    return Response.json({ error: "media_not_found" }, { status: 404 });
  }
  if (bytes > MAX_DIRECT_VIDEO_UPLOAD_BYTES) {
    return Response.json({ error: "clip_too_large" }, { status: 400 });
  }

  const db = getDb();
  // If another submission already references this object it's already counted,
  // so it neither re-checks the quota nor double-counts.
  const [[existingSubmission], [existingImport]] = await Promise.all([
    db
      .select({ id: submissions.id })
      .from(submissions)
      .where(
        and(eq(submissions.userId, userId), eq(submissions.mediaKey, mediaKey)),
      )
      .limit(1),
    db
      .select({ id: importedPlatformMedia.id })
      .from(importedPlatformMedia)
      .where(
        and(
          eq(importedPlatformMedia.userId, userId),
          eq(importedPlatformMedia.mediaKey, mediaKey),
        ),
      )
      .limit(1),
  ]);
  if (!existingSubmission && !existingImport) {
    const [used, quota] = await Promise.all([
      getStorageBytes(userId),
      getStorageQuota(userId),
    ]);
    if (used + bytes > quota) {
      return Response.json({ error: "storage_full" }, { status: 402 });
    }
  }

  // Keep the durable reference and its accounting in one transaction. If two
  // saves race on the same key, the per-object advisory lock lets the first
  // transaction count it and the second observe that committed reference.
  const quota = await getStorageQuota(userId);
  let submission;
  try {
    submission = await db.transaction(async (tx) => {
      // Acquire the object lock before publishing the new reference. Otherwise
      // a concurrent last-reference deletion can remove the R2 object while
      // this transaction is still inserting a row that will point at it.
      await lockStorageUserWithinTx(tx, userId);
      await lockMediaReferenceWithinTx(tx, userId, mediaKey);
      const [inserted] = await tx
        .insert(submissions)
        .values({
          userId,
          kind: "video",
          status: "complete", // saved, no analysis; feedback/scores stay null
          title,
          mediaKey,
          mediaBytes: bytes,
          durationSec,
        })
        .returning({
          id: submissions.id,
          mediaKey: submissions.mediaKey,
          createdAt: submissions.createdAt,
        });
      await activateObjectWithinTx(tx, userId, mediaKey, bytes, "recording");
      await countMediaOnceWithinTx(
        tx,
        userId,
        mediaKey,
        bytes,
        inserted.id,
        quota,
      );
      return inserted;
    });
  } catch (error) {
    if (error instanceof StorageQuotaError) {
      return Response.json({ error: "storage_full" }, { status: 402 });
    }
    throw error;
  }

  return Response.json({ submission }, { status: 201 });
}
