import { auth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import {
  preflightPaidActionOrResponse,
  refundCreditReservation,
  reservePaidActionOrResponse,
} from "@/lib/billing/actions";
import { createContentItem } from "@/lib/db/content";
import { captureIdea, capturedIdeaToBlocks } from "@/lib/content/capture";
import { normalizeHooks } from "@/lib/content/normalize";
import { getProjectContextSafe } from "@/lib/content/project-context-server";
import {
  guardProviderIngress,
  guardProviderSpend,
} from "@/lib/provider-rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

const strArr = (v: unknown, max: number): string[] =>
  Array.isArray(v)
    ? v.filter((x): x is string => typeof x === "string").slice(0, max)
    : [];

/**
 * Talk-or-type capture funnel: enrich a rough idea into a titled, classified
 * content item and persist it. FREE (no credits) — this is the frictionless
 * front door; the credited deep generation stays in the workbench.
 */
export async function POST(req: NextRequest): Promise<Response> {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const ingressLimited = await guardProviderIngress(req);
  if (ingressLimited) return ingressLimited;

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) return Response.json({ error: "no_input" }, { status: 400 });
  // Classification only needs the pillars, not the voice or the offers.
  const context = await getProjectContextSafe(userId, "pillars");
  const pillars = context.pillarNames.length
    ? context.pillarNames
    : strArr(body.pillars, 12);
  if (!process.env.SURPLUS_API_KEY) {
    return Response.json({ error: "no_provider" }, { status: 501 });
  }
  const billing = await preflightPaidActionOrResponse(userId, "capture_idea");
  if (billing) return billing;

  const spendLimited = await guardProviderSpend(req, userId, "content-capture");
  if (spendLimited) return spendLimited;
  const access = await reservePaidActionOrResponse(userId, "capture_idea");
  if (access.response) return access.response;
  const { reservation } = access;

  try {
    const idea = await captureIdea(
      { text, pillars, context: context.block },
      req.signal,
    );
    const item = await createContentItem(userId, {
      title: idea.title,
      // The capture prompt returns bare hook lines; they carry no pattern
      // attribution until the hook engine generates them.
      hooks: normalizeHooks(idea.hooks),
      // The angle and points become blocks, not the retired fixed columns, so
      // a captured idea and an expanded one have the same body model.
      blocks: capturedIdeaToBlocks(idea),
      pillar: idea.pillar ?? undefined,
      status: "drafted",
    });

    return Response.json({
      item,
      pillar: idea.pillar,
      balance: reservation.balance,
    });
  } catch (e) {
    const detail = e instanceof Error ? e.message : "capture_failed";
    await refundCreditReservation(userId, reservation, detail);
    return Response.json({ error: "capture_failed", detail }, { status: 502 });
  }
}
