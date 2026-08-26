import { auth } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { getDb } from "@/lib/db/client";
import { createContentItem, listContentItems } from "@/lib/db/content";
import { submissions } from "@/lib/db/schema";
import { ensureUser } from "@/lib/db/users";
import { parseContentInput } from "@/lib/content/input";
import { parseIdeaFields } from "@/lib/ideas/input";

export const runtime = "nodejs";

/** The signed-in user's Content Library (summaries, newest-updated first). */
export async function GET(req: NextRequest): Promise<Response> {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const poster = req.nextUrl.searchParams.get("surface") === "poster";
  const items = await listContentItems(userId, {
    includePosterUploads: poster,
    // The library is the pipeline, not the inbox. The poster surface wants
    // everything recordable, so it is the one caller that spans both stages.
    stage: poster ? undefined : "library",
  });
  return Response.json({ items });
}

/** Create a library item (a drafted idea). Body fields are clamped; status
 * defaults to drafted at the DB. */
export async function POST(req: NextRequest): Promise<Response> {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  await ensureUser(userId);

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const { input, badStatus } = parseContentInput(body);
  // New Poster uploads need their pending transcript state on the very first
  // response. Without this, the UI briefly treats an in-flight transcript as
  // absent and allows title-only caption generation.
  Object.assign(input, parseIdeaFields(body));
  if (badStatus) return Response.json({ error: "bad_status" }, { status: 400 });
  // Poster creates the content row and attaches the just-registered upload in
  // one request. The shared parser intentionally drops foreign keys, so this
  // ownership check must restore the id explicitly (the PATCH route does the
  // same). Dropping it here made a successful upload disappear immediately.
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
  // Same invariant as PATCH (and the DB CHECK): scheduled requires a date.
  if (input.status === "scheduled" && !(input.scheduledFor instanceof Date)) {
    return Response.json({ error: "scheduled_needs_date" }, { status: 400 });
  }

  // Anything created through this route is a library item; ideas go through
  // /api/ideas, which stamps stage explicitly.
  const item = await createContentItem(userId, { ...input, stage: "library" });
  return Response.json({ item }, { status: 201 });
}
