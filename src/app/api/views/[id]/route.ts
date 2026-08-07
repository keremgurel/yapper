import { auth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import { deleteView, updateView } from "@/lib/db/library-views";
import { parseViewInput } from "@/lib/views/input";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

/** Replace one of the creator's own views. Every query is owner-scoped, so an
 * id belonging to someone else matches nothing rather than editing their view. */
export async function PATCH(req: NextRequest, { params }: Params) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const input = parseViewInput(body);
  if (!input) return Response.json({ error: "bad_view" }, { status: 400 });

  const view = await updateView(userId, id, input);
  if (!view) return Response.json({ error: "not_found" }, { status: 404 });
  return Response.json({ view });
}

export async function DELETE(_req: Request, { params }: Params) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const removed = await deleteView(userId, id);
  if (!removed) return Response.json({ error: "not_found" }, { status: 404 });
  return Response.json({ ok: true });
}
