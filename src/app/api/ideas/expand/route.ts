import { auth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import {
  preflightPaidActionOrResponse,
  refundCreditReservation,
  reservePaidActionOrResponse,
} from "@/lib/billing/actions";
import { getProjectContextSafe } from "@/lib/content/project-context-server";
import { expandIdea } from "@/lib/ideas/expand";
import { parseExpandIdeaInput } from "@/lib/ideas/expand-input";
import {
  guardProviderIngress,
  guardProviderSpend,
} from "@/lib/provider-rate-limit";
import {
  readBoundedJson,
  requestBodyErrorResponse,
} from "@/lib/http/bounded-body";

export const runtime = "nodejs";
export const maxDuration = 60;
const MAX_JSON_BYTES = 256 * 1024;

/**
 * Expand a raw idea into a reference-specific creative dossier. The creator's
 * original words and the source transcript are preserved client-side; this only
 * builds the regenerable analysis around them.
 */
export async function POST(req: NextRequest): Promise<Response> {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const ingressLimited = await guardProviderIngress(req);
  if (ingressLimited) return ingressLimited;

  let rawBody: unknown;
  try {
    rawBody = await readBoundedJson(req, { maxBytes: MAX_JSON_BYTES });
  } catch (error) {
    const response = requestBodyErrorResponse(error);
    if (response) return response;
    throw error;
  }
  const body =
    rawBody && typeof rawBody === "object" && !Array.isArray(rawBody)
      ? (rawBody as Record<string, unknown>)
      : {};
  const input = parseExpandIdeaInput(body.input);
  if (!input) {
    return Response.json({ error: "no_input" }, { status: 400 });
  }
  // The creator's standing context is read server-side rather than trusted from
  // the client, so a request cannot claim someone else's pillars or voice.
  const context = await getProjectContextSafe(userId);
  if (!process.env.SURPLUS_API_KEY) {
    return Response.json({ error: "no_provider" }, { status: 501 });
  }
  const billing = await preflightPaidActionOrResponse(userId, "expand_idea");
  if (billing) return billing;

  const spendLimited = await guardProviderSpend(req, userId, "ideas-expand");
  if (spendLimited) return spendLimited;
  const access = await reservePaidActionOrResponse(userId, "expand_idea");
  if (access.response) return access.response;
  const { reservation } = access;

  try {
    const expansion = await expandIdea(input, context, req.signal);
    return Response.json({ expansion, balance: reservation.balance });
  } catch (e) {
    const detail = e instanceof Error ? e.message : "expand_failed";
    await refundCreditReservation(userId, reservation, detail);
    const status = detail === "no_provider" ? 501 : 502;
    return Response.json({ error: "expand_failed", detail }, { status });
  }
}
