import { after } from "next/server";
import {
  enrichRecording,
  hydrateRecording,
} from "@/lib/content/recording-memory";
import { auth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import { deleteContentItem } from "@/lib/db/content";
import { updateOwnContentItem } from "@/lib/content/operations/update-item";
import { refusalResponse } from "@/lib/http/operation-result";
import {
  normalizeBlocks,
  normalizeBody,
  normalizeHooks,
} from "@/lib/content/normalize";
import { listContentVersions } from "@/lib/db/content-versions";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

/** Full detail for one of the user's own library items. */
export async function GET(_req: Request, { params }: Params) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const item = await hydrateRecording(userId, id);
  if (!item) return Response.json({ error: "not_found" }, { status: 404 });
  after(() => enrichRecording(userId, id));
  // Legacy rows are widened here, so no client has to know the old shape.
  const versions = await listContentVersions(userId, id);
  return Response.json({
    item: {
      ...item,
      ...normalizeBody(item),
      versions: versions.map((v) => ({
        ...v,
        hooks: normalizeHooks(v.hooks),
        blocks: normalizeBlocks(v.blocks),
      })),
    },
  });
}

/** Partial update (workbench autosave, status changes, recording link). The
 * ownership checks live in the shared operation, which Chirpy calls too. */
export async function PATCH(req: NextRequest, { params }: Params) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const updated = await updateOwnContentItem(userId, id, body);
  if (!updated.ok) return refusalResponse(updated);
  if (updated.value.enrichRecording) after(() => enrichRecording(userId, id));
  return Response.json({ item: updated.value.item });
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
