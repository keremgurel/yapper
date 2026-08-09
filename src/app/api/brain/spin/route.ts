import { auth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import {
  refundCreditReservation,
  reservePaidActionOrResponse,
} from "@/lib/billing/actions";
import { recentTitles, spinReels } from "@/lib/brain/reels";
import { formatsIn } from "@/lib/brain/formats";
import { spinIdea } from "@/lib/brain/spin";
import { getProjectContextSafe } from "@/lib/content/project-context-server";
import { listContentItems } from "@/lib/db/content";
import { listBrainBlocks } from "@/lib/db/project-brain";
import { getActiveProject } from "@/lib/db/projects";
import { ensureUser } from "@/lib/db/users";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Pull the handle: three reels, then one idea written for what they landed on.
 *
 * The reels are span here rather than in the browser so the formats come from
 * the creator's own brain, and so a client cannot deal itself a combination the
 * creator never set up.
 */
export async function POST(req: NextRequest): Promise<Response> {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  await ensureUser(userId);
  const project = await getActiveProject(userId);
  const context = await getProjectContextSafe(userId);

  const [blocks, items] = await Promise.all([
    listBrainBlocks(project.id),
    listContentItems(userId),
  ]);

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  // A creator can hold one reel still: "another one in this pillar".
  const heldPillar =
    typeof body.pillar === "string" && body.pillar.trim()
      ? body.pillar.trim()
      : null;
  const pillars = context.pillarNames;

  const combination = spinReels({
    pillars: heldPillar ? [heldPillar] : pillars,
    formats: formatsIn(blocks),
  });

  const access = await reservePaidActionOrResponse(userId, "capture_idea");
  if (access.response) return access.response;
  const { reservation } = access;

  try {
    const idea = await spinIdea({
      combination,
      context: context.block,
      pillars,
      avoid: recentTitles(items.map((item) => item.title ?? "")),
    });
    return Response.json({ idea });
  } catch (error) {
    await refundCreditReservation(userId, reservation, "spin_failed");
    console.error("[brain/spin] failed", error);
    return Response.json({ error: "spin_failed" }, { status: 502 });
  }
}
