import { auth } from "@clerk/nextjs/server";
import { UUID } from "@/lib/chirpy/protocol";
import { refusalResponse } from "@/lib/http/operation-result";
import { deleteLook } from "@/lib/style-library/operations/delete-look";
import { editLook } from "@/lib/style-library/operations/edit-look";
import { parseLookEdit } from "@/lib/style-library/operations/look-input";
import { lookPayload } from "@/lib/style-library/operations/look-template";
import type { TemplateEdit } from "@/lib/style-library/templates/edit-template";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

/**
 * Rename a look or change it. The body is the same list of edits Chirpy and a
 * connector send, so an inspector control and a sentence save the same thing.
 */
export async function PATCH(req: Request, { params }: Params) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const input = UUID.test(id)
    ? parseLookEdit(id, await req.json().catch(() => null))
    : null;
  if (!input) return Response.json({ error: "bad_request" }, { status: 400 });
  const edited = await editLook(userId, id, {
    name: input.name,
    edits: input.edits as TemplateEdit[] | undefined,
  });
  if (!edited.ok) return refusalResponse(edited);
  return Response.json({
    look: lookPayload(edited.value.look),
    notes: edited.value.notes,
  });
}

export async function DELETE(_req: Request, { params }: Params) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const removed = UUID.test(id) ? await deleteLook(userId, id) : null;
  if (!removed?.ok)
    return Response.json({ error: "not_found" }, { status: 404 });
  return Response.json({ ok: true });
}
