import { auth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import {
  preflightPaidActionOrResponse,
  refundCreditReservation,
  reservePaidActionOrResponse,
} from "@/lib/billing/actions";
import { proposeIngest } from "@/lib/brain/ingest";
import { ensureUser } from "@/lib/db/users";
import {
  guardProviderIngress,
  guardProviderSpend,
} from "@/lib/provider-rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

const SAMPLE_MAX = 4_000;
const SHAPE_MAX = 200;

/**
 * Name a paste, so it can be filed.
 *
 * Only the sample reaches this route, never the import. The browser already
 * parsed the whole thing with the same pure code the server would have used,
 * which means a creator can drop a five thousand row export and see it laid out
 * before anything is uploaded, and the naming call costs the same as naming
 * five rows.
 *
 * Nothing is saved here. The proposal goes back to a preview the creator edits,
 * and saving is an ordinary block create.
 */
export async function POST(req: NextRequest): Promise<Response> {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const ingressLimited = await guardProviderIngress(req);
  if (ingressLimited) return ingressLimited;

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const sample =
    typeof body.sample === "string" ? body.sample.slice(0, SAMPLE_MAX) : "";
  const shape =
    typeof body.shape === "string" ? body.shape.slice(0, SHAPE_MAX) : "";
  if (!sample.trim()) {
    return Response.json({ error: "no_input" }, { status: 400 });
  }

  await ensureUser(userId);
  if (!process.env.SURPLUS_API_KEY) {
    return Response.json({ error: "no_provider" }, { status: 501 });
  }
  const billing = await preflightPaidActionOrResponse(userId, "ingest_context");
  if (billing) return billing;

  const spendLimited = await guardProviderSpend(req, userId, "brain-ingest");
  if (spendLimited) return spendLimited;
  const access = await reservePaidActionOrResponse(userId, "ingest_context");
  if (access.response) return access.response;
  const { reservation } = access;

  try {
    const proposal = await proposeIngest({ shape, sample }, req.signal);
    return Response.json({ proposal, balance: reservation.balance });
  } catch (error) {
    await refundCreditReservation(userId, reservation, "ingest_failed");
    console.error("[brain/ingest] failed", error);
    return Response.json({ error: "ingest_failed" }, { status: 502 });
  }
}
