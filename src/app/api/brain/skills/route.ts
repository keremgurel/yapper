import { auth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import { createSkill, reorderSkills } from "@/lib/brain/operations/skills";
import { parseNewSkill, parseSkillOrder } from "@/lib/brain/skill-input";
import { listProjectSkillsWithDefaults } from "@/lib/db/project-skills";
import { getActiveProject } from "@/lib/db/projects";
import { refusalResponse } from "@/lib/http/operation-result";
import { withServerTiming } from "@/lib/http/server-timing";

export const runtime = "nodejs";

/** Every skill the creator has installed or written, in their order. */
export const GET = withServerTiming(async (): Promise<Response> => {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const project = await getActiveProject(userId);
  return Response.json({
    skills: await listProjectSkillsWithDefaults(project.id),
  });
});

/** Write one from scratch. */
export async function POST(req: NextRequest): Promise<Response> {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const input = parseNewSkill(body);
  if (!input) return Response.json({ error: "no_name" }, { status: 400 });

  const result = await createSkill(userId, input);
  if (!result.ok) return refusalResponse(result);
  return Response.json({ skill: result.value }, { status: 201 });
}

/** The creator's own order, as a list of ids. */
export async function PATCH(req: NextRequest): Promise<Response> {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const order = parseSkillOrder(body.order);
  if (!order) return Response.json({ error: "no_order" }, { status: 400 });

  const result = await reorderSkills(userId, order);
  if (!result.ok) return refusalResponse(result);
  return Response.json({ skills: result.value });
}
