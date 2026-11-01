import { auth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import {
  createKnowledge,
  reorderKnowledge,
} from "@/lib/brain/operations/knowledge";
import { parseBlockOrder, parseNewBrainBlock } from "@/lib/brain/input";
import { listBrainBlocks } from "@/lib/db/project-brain";
import { getActiveProject } from "@/lib/db/projects";
import { refusalResponse } from "@/lib/http/operation-result";
import { withServerTiming } from "@/lib/http/server-timing";

export const runtime = "nodejs";

/** Everything the creator has written into their brain, in their order. */
export const GET = withServerTiming(async (): Promise<Response> => {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const project = await getActiveProject(userId);
  return Response.json({ blocks: await listBrainBlocks(project.id) });
});

/** Add a section. */
export async function POST(req: NextRequest): Promise<Response> {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const input = parseNewBrainBlock(body);
  if (!input) return Response.json({ error: "no_title" }, { status: 400 });

  const result = await createKnowledge(userId, input);
  if (!result.ok) return refusalResponse(result);
  return Response.json({ block: result.value }, { status: 201 });
}

/** The creator's own order, as a list of ids. */
export async function PATCH(req: NextRequest): Promise<Response> {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const order = parseBlockOrder(body.order);
  if (!order) return Response.json({ error: "no_order" }, { status: 400 });

  const result = await reorderKnowledge(userId, order);
  if (!result.ok) return refusalResponse(result);
  return Response.json({ blocks: result.value });
}
