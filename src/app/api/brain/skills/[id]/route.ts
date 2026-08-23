import { auth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import { invalidateBrainContext } from "@/lib/brain/context/server";
import { parseSkillInput } from "@/lib/brain/skill-input";
import {
  deleteProjectSkill,
  updateProjectSkill,
} from "@/lib/db/project-skills";
import { getActiveProject } from "@/lib/db/projects";
import { ensureUser } from "@/lib/db/users";

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

  await ensureUser(userId);
  const project = await getActiveProject(userId);
  const skill = await updateProjectSkill(project.id, id, input);
  if (!skill) return Response.json({ error: "not_found" }, { status: 404 });
  invalidateBrainContext(project.id);
  return Response.json({ skill });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;

  await ensureUser(userId);
  const project = await getActiveProject(userId);
  const removed = await deleteProjectSkill(project.id, id);
  if (!removed) return Response.json({ error: "not_found" }, { status: 404 });
  invalidateBrainContext(project.id);
  return Response.json({ ok: true });
}
