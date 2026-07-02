import { auth } from "@clerk/nextjs/server";
import { desc, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { getDb } from "@/lib/db/client";
import { FREE_STORAGE_BYTES, MAX_CLIP_BYTES } from "@/lib/db/constants";
import { submissions } from "@/lib/db/schema";
import { countMediaOnce } from "@/lib/db/storage-accounting";
import { ensureUser, getStorageBytes } from "@/lib/db/users";
import { canUsePremium } from "@/lib/billing/gate";
import { headObjectBytes, ownsKey } from "@/lib/r2";

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

/**
 * Register an uploaded recording as a submission WITHOUT running feedback
 * ("save this take"): the client presign-PUTs to R2 first (/api/media/upload-url),
 * then posts the mediaKey here. The claimed size is never trusted: we HeadObject
 * for the actual bytes, enforce the per-clip cap and the storage quota on them,
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
  if (bytes > MAX_CLIP_BYTES) {
    return Response.json({ error: "clip_too_large" }, { status: 400 });
  }

  const db = getDb();
  // If another submission already references this object it's already counted,
  // so it neither re-checks the quota nor double-counts.
  const [existing] = await db
    .select({ id: submissions.id })
    .from(submissions)
    .where(eq(submissions.mediaKey, mediaKey))
    .limit(1);
  if (!existing) {
    const used = await getStorageBytes(userId);
    if (used + bytes > FREE_STORAGE_BYTES) {
      return Response.json({ error: "storage_full" }, { status: 402 });
    }
  }

  const [submission] = await db
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

  await countMediaOnce(userId, mediaKey, bytes, submission.id);

  return Response.json({ submission }, { status: 201 });
}
