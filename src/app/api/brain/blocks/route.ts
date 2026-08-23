import { auth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import { parseBlockOrder, parseNewBrainBlock } from "@/lib/brain/input";
import { invalidateBrainContext } from "@/lib/brain/context/server";
import {
  createBrainBlock,
  listBrainBlocks,
  reorderBrainBlocks,
} from "@/lib/db/project-brain";
import { getActiveProject } from "@/lib/db/projects";
import { ensureUser } from "@/lib/db/users";

export const runtime = "nodejs";

/** Everything the creator has written into their brain, in their order. */
export async function GET(): Promise<Response> {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  await ensureUser(userId);
  const project = await getActiveProject(userId);
  return Response.json({ blocks: await listBrainBlocks(project.id) });
}

/** Add a section. */
export async function POST(req: NextRequest): Promise<Response> {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const input = parseNewBrainBlock(body);
  if (!input) return Response.json({ error: "no_title" }, { status: 400 });

  await ensureUser(userId);
  const project = await getActiveProject(userId);
  const block = await createBrainBlock(project.id, input);
  invalidateBrainContext(project.id);
  return Response.json({ block }, { status: 201 });
}

/** The creator's own order, as a list of ids. */
export async function PATCH(req: NextRequest): Promise<Response> {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const order = parseBlockOrder(body.order);
  if (!order) return Response.json({ error: "no_order" }, { status: 400 });

  await ensureUser(userId);
  const project = await getActiveProject(userId);
  const blocks = await reorderBrainBlocks(project.id, order);
  invalidateBrainContext(project.id);
  return Response.json({ blocks });
}
