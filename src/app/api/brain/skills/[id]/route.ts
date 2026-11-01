import { auth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import { deleteSkill, updateSkill } from "@/lib/brain/operations/skills";
import { parseSkillInput } from "@/lib/brain/skill-input";
import { refusalResponse } from "@/lib/http/operation-result";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

/** Save an edit, or flip the switch. Scoped by project as well as id, so an id
 * guessed from another creator's brain resolves to nothing. */
export async function PATCH(req: NextRequest, { params }: Params) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const input = parseSkillInput(body);
  if (!Object.keys(input).length) {
    return Response.json({ error: "no_fields" }, { status: 400 });
  }

  const result = await updateSkill(userId, id, input);
  if (!result.ok) return refusalResponse(result);
  return Response.json({ skill: result.value });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;

  const result = await deleteSkill(userId, id);
  if (!result.ok) return refusalResponse(result);
  return Response.json({ ok: true });
}
