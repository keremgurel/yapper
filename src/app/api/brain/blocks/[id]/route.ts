import { auth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import { parseBrainBlockInput } from "@/lib/brain/input";
import { invalidateProjectContext } from "@/lib/content/project-context-server";
import { deleteBrainBlock, updateBrainBlock } from "@/lib/db/project-brain";
import { getActiveProject } from "@/lib/db/projects";
import { ensureUser } from "@/lib/db/users";

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

  await ensureUser(userId);
  const project = await getActiveProject(userId);
  const block = await updateBrainBlock(project.id, id, input);
  if (!block) return Response.json({ error: "not_found" }, { status: 404 });
  invalidateProjectContext(project.id);
  return Response.json({ block });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;

  await ensureUser(userId);
  const project = await getActiveProject(userId);
  const removed = await deleteBrainBlock(project.id, id);
  if (!removed) return Response.json({ error: "not_found" }, { status: 404 });
  invalidateProjectContext(project.id);
  return Response.json({ ok: true });
}
