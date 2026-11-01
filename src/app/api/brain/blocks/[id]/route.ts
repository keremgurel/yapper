import { auth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import { parseBrainBlockInput } from "@/lib/brain/input";
import {
  deleteKnowledge,
  updateKnowledge,
} from "@/lib/brain/operations/knowledge";
import { refusalResponse } from "@/lib/http/operation-result";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

/** Save an edit. Absent keys are left alone, so the page autosaves one field at
 * a time without blanking the others. */
export async function PATCH(req: NextRequest, { params }: Params) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const input = parseBrainBlockInput(body);
  if (!Object.keys(input).length) {
    return Response.json({ error: "no_fields" }, { status: 400 });
  }

  const result = await updateKnowledge(userId, id, input);
  if (!result.ok) return refusalResponse(result);
  return Response.json({ block: result.value });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;

  const result = await deleteKnowledge(userId, id);
  if (!result.ok) return refusalResponse(result);
  return Response.json({ ok: true });
}
