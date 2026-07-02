import { auth } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { getDb } from "@/lib/db/client";
import {
  deleteContentItem,
  getContentItem,
  updateContentItem,
} from "@/lib/db/content";
import { submissions } from "@/lib/db/schema";
import { parseContentInput } from "@/lib/content/input";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

/** Full detail for one of the user's own library items. */
export async function GET(_req: Request, { params }: Params) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const item = await getContentItem(userId, id);
  if (!item) return Response.json({ error: "not_found" }, { status: 404 });
  return Response.json({ item });
}

/**
 * Partial update (workbench autosave, status changes, recording link).
 * - status=scheduled requires a scheduledFor (in this payload or already set).
 * - submissionId must be the caller's own submission (or null to unlink).
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const { input, badStatus } = parseContentInput(body);
  if (badStatus) return Response.json({ error: "bad_status" }, { status: 400 });

  // Linking a recording: verify the submission is the caller's own. (The FK
  // only proves existence; without this a user could link someone else's.)
  if (body.submissionId !== undefined) {
    if (body.submissionId === null) input.submissionId = null;
    else if (typeof body.submissionId === "string") {
      const [own] = await getDb()
        .select({ id: submissions.id })
        .from(submissions)
        .where(
          and(
            eq(submissions.id, body.submissionId),
            eq(submissions.userId, userId),
          ),
        )
        .limit(1);
      if (!own) {
        return Response.json({ error: "bad_submission" }, { status: 400 });
      }
      input.submissionId = own.id;
    }
  }

  if (input.status === "scheduled" && !(input.scheduledFor instanceof Date)) {
    // Explicitly nulling the date while setting scheduled is also invalid.
    if (input.scheduledFor === null) {
      return Response.json({ error: "scheduled_needs_date" }, { status: 400 });
    }
    const existing = await getContentItem(userId, id);
    if (!existing)
      return Response.json({ error: "not_found" }, { status: 404 });
    if (!existing.scheduledFor) {
      return Response.json({ error: "scheduled_needs_date" }, { status: 400 });
    }
  }

  const item = await updateContentItem(userId, id, input);
  if (!item) return Response.json({ error: "not_found" }, { status: 404 });
  return Response.json({ item });
}

/** Delete one of the user's own items. The linked submission (if any) is NOT
 * deleted; recordings live in Sessions and are managed there. */
export async function DELETE(_req: Request, { params }: Params) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const deleted = await deleteContentItem(userId, id);
  if (!deleted) return Response.json({ error: "not_found" }, { status: 404 });
  return Response.json({ ok: true });
}
