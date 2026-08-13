import { auth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import {
  preflightPaidActionOrResponse,
  refundCreditReservation,
  reservePaidActionOrResponse,
} from "@/lib/billing/actions";
import {
  brainstorm,
  type ChatMessage,
  type ClipContext,
} from "@/lib/content/brainstorm";
import { getProjectContextSafe } from "@/lib/content/project-context-server";
import {
  guardProviderIngress,
  guardProviderSpend,
} from "@/lib/provider-rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

const asMessages = (v: unknown): ChatMessage[] =>
  Array.isArray(v)
    ? v
        .filter(
          (m): m is ChatMessage =>
            !!m &&
            typeof m === "object" &&
            (m as ChatMessage).role !== undefined &&
            typeof (m as ChatMessage).content === "string",
        )
        .slice(-12)
    : [];

/** Conversational ideation off a reference clip. Auth-gated, no credits (the
 * free ideation funnel; deep script generation stays gated in the workbench). */
export async function POST(req: NextRequest): Promise<Response> {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const ingressLimited = await guardProviderIngress(req);
  if (ingressLimited) return ingressLimited;

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const clip = body.clip as ClipContext | undefined;
  if (!clip || typeof clip.title !== "string") {
    return Response.json({ error: "no_clip" }, { status: 400 });
  }
  const pillars = Array.isArray(body.pillars)
    ? (body.pillars.filter((p) => typeof p === "string") as string[]).slice(
        0,
        12,
      )
    : [];
  // Read server-side: a client must not be able to claim a different voice.
  const context = await getProjectContextSafe(userId);
  if (!process.env.SURPLUS_API_KEY) {
    return Response.json({ error: "no_provider" }, { status: 501 });
  }
  const billing = await preflightPaidActionOrResponse(userId, "brainstorm");
  if (billing) return billing;

  const spendLimited = await guardProviderSpend(
    req,
    userId,
    "content-brainstorm",
  );
  if (spendLimited) return spendLimited;
  const access = await reservePaidActionOrResponse(userId, "brainstorm");
  if (access.response) return access.response;
  const { reservation } = access;

  try {
    const reply = await brainstorm({
      messages: asMessages(body.messages),
      clip,
      pillars: context.pillarNames.length ? context.pillarNames : pillars,
      context: context.block,
    });
    return Response.json({ reply, balance: reservation.balance });
  } catch (e) {
    const detail = e instanceof Error ? e.message : "brainstorm_failed";
    await refundCreditReservation(userId, reservation, detail);
    return Response.json(
      { error: "brainstorm_failed", detail },
      { status: 502 },
    );
  }
}
