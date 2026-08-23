import { auth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import { invalidateBrainContext } from "@/lib/brain/context/server";
import { parseNewSkill, parseSkillOrder } from "@/lib/brain/skill-input";
import {
  createProjectSkill,
  listProjectSkills,
  reorderProjectSkills,
} from "@/lib/db/project-skills";
import { getActiveProject } from "@/lib/db/projects";
import { ensureUser } from "@/lib/db/users";

export const runtime = "nodejs";

/** Every skill the creator has installed or written, in their order. */
export async function GET(): Promise<Response> {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  await ensureUser(userId);
  const project = await getActiveProject(userId);
  return Response.json({ skills: await listProjectSkills(project.id) });
}

/** Write one from scratch. */
export async function POST(req: NextRequest): Promise<Response> {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const input = parseNewSkill(body);
  if (!input) return Response.json({ error: "no_name" }, { status: 400 });

  await ensureUser(userId);
  const project = await getActiveProject(userId);
  const skill = await createProjectSkill(project.id, input);
  invalidateBrainContext(project.id);
  return Response.json({ skill }, { status: 201 });
}

/** The creator's own order, as a list of ids. */
export async function PATCH(req: NextRequest): Promise<Response> {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const order = parseSkillOrder(body.order);
  if (!order) return Response.json({ error: "no_order" }, { status: 400 });

  await ensureUser(userId);
  const project = await getActiveProject(userId);
  const skills = await reorderProjectSkills(project.id, order);
  invalidateBrainContext(project.id);
  return Response.json({ skills });
}
