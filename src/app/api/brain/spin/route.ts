import { auth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import {
  preflightPaidActionOrResponse,
  refundCreditReservation,
  reservePaidActionOrResponse,
} from "@/lib/billing/actions";
import { recentTitles, spinReels } from "@/lib/brain/reels";
import { formatsIn } from "@/lib/brain/formats";
import { spinIdea } from "@/lib/brain/spin";
import { getBrainContextSafe } from "@/lib/brain/context/server";
import { listContentItems } from "@/lib/db/content";
import { listBrainBlocks } from "@/lib/db/project-brain";
import { listPillars } from "@/lib/db/project-pillars";
import { getActiveProject } from "@/lib/db/projects";
import { ensureUser } from "@/lib/db/users";
import {
  guardProviderIngress,
  guardProviderSpend,
} from "@/lib/provider-rate-limit";

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
  const ingressLimited = await guardProviderIngress(req);
  if (ingressLimited) return ingressLimited;

  await ensureUser(userId);
  const project = await getActiveProject(userId);

  const [blocks, pillarRows, items] = await Promise.all([
    listBrainBlocks(project.id),
    listPillars(project.id),
    listContentItems(userId),
  ]);
  const pillars = pillarRows.map((pillar) => pillar.name).filter(Boolean);

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  // A creator can hold one reel still: "another one in this pillar".
  const heldPillar =
    typeof body.pillar === "string" && body.pillar.trim()
      ? body.pillar.trim()
      : null;
  const combination = spinReels({
    pillars: heldPillar ? [heldPillar] : pillars,
    formats: formatsIn(blocks),
  });
  if (!process.env.SURPLUS_API_KEY) {
    return Response.json({ error: "no_provider" }, { status: 501 });
  }
  const billing = await preflightPaidActionOrResponse(userId, "capture_idea");
  if (billing) return billing;

  const spendLimited = await guardProviderSpend(req, userId, "brain-spin");
  if (spendLimited) return spendLimited;
  const access = await reservePaidActionOrResponse(userId, "capture_idea");
  if (access.response) return access.response;
  const { reservation } = access;

  // The reels are span first so the combination itself is the routing signal:
  // a spin that landed on a pillar about pricing should pull in the pricing
  // section, not whatever sits at the top of the brain.
  const context = await getBrainContextSafe(userId, {
    surface: "ideate",
    task: [combination.pillar, combination.angle, combination.format]
      .filter(Boolean)
      .join("\n"),
    signal: req.signal,
  });
  try {
    const idea = await spinIdea(
      {
        combination,
        context: context.section,
        pillars,
        avoid: recentTitles(items.map((item) => item.title ?? "")),
      },
      req.signal,
    );
    return Response.json({ idea, used: context.used });
  } catch (error) {
    await refundCreditReservation(userId, reservation, "spin_failed");
    console.error("[brain/spin] failed", error);
    return Response.json({ error: "spin_failed" }, { status: 502 });
  }
}
