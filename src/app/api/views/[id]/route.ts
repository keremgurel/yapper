import { auth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import { deleteView } from "@/lib/db/library-views";
import { refusalResponse } from "@/lib/http/operation-result";
import { updateOwnView } from "@/lib/views/operations/update-view";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

/** Replace one of the creator's own views. Every query is owner-scoped, so an
 * id belonging to someone else matches nothing rather than editing their view. */
export async function PATCH(req: NextRequest, { params }: Params) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const updated = await updateOwnView(userId, id, body);
  if (!updated.ok) return refusalResponse(updated);
  return Response.json({ view: updated.value });
}

export async function DELETE(_req: Request, { params }: Params) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const removed = await deleteView(userId, id);
  if (!removed) return Response.json({ error: "not_found" }, { status: 404 });
  return Response.json({ ok: true });
}
