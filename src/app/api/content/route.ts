import { auth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import { createContentItem, listContentItems } from "@/lib/db/content";
import { ensureUser } from "@/lib/db/users";
import { parseContentInput } from "@/lib/content/input";

export const runtime = "nodejs";

/** The signed-in user's Content Library (summaries, newest-updated first). */
export async function GET(): Promise<Response> {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const items = await listContentItems(userId);
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
  if (badStatus) return Response.json({ error: "bad_status" }, { status: 400 });
  // Same invariant as PATCH (and the DB CHECK): scheduled requires a date.
  if (input.status === "scheduled" && !(input.scheduledFor instanceof Date)) {
    return Response.json({ error: "scheduled_needs_date" }, { status: 400 });
  }

  const item = await createContentItem(userId, input);
  return Response.json({ item }, { status: 201 });
}
