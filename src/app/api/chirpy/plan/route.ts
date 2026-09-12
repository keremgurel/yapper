import { auth } from "@clerk/nextjs/server";
import {
  readBoundedJson,
  requestBodyErrorResponse,
} from "@/lib/http/bounded-body";
import {
  guardProviderIngress,
  guardProviderSpend,
} from "@/lib/provider-rate-limit";
import { ensureUser } from "@/lib/db/users";
import { canUsePremium } from "@/lib/billing/gate";
import { InsufficientCreditsError } from "@/lib/db/credits";
import { parsePlanInput } from "@/lib/chirpy/protocol";
import { withPlanLedger, PlanConflict } from "@/lib/chirpy/ledger";
import { planChirpy } from "@/lib/chirpy/planner";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request): Promise<Response> {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const ingress = await guardProviderIngress(req);
  if (ingress) return ingress;
  try {
    const input = parsePlanInput(
      await readBoundedJson(req, { maxBytes: 512 * 1024 }),
    );
    if (!input) return Response.json({ error: "bad_request" }, { status: 400 });
    await ensureUser(userId);
    const reply = await withPlanLedger(userId, input, async () => {
      if (!(await canUsePremium(userId)))
        throw Response.json({ error: "not_entitled" }, { status: 402 });
      if (!process.env.SURPLUS_API_KEY)
        throw Response.json({ error: "no_provider" }, { status: 501 });
      const limited = await guardProviderSpend(req, userId, "chirpy-plan");
      if (limited) throw limited;
      return planChirpy(input, req.signal);
    });
    return Response.json(reply);
  } catch (error) {
    if (error instanceof Response) return error;
    const bounded = requestBodyErrorResponse(error);
    if (bounded) return bounded;
    if (error instanceof InsufficientCreditsError)
      return Response.json({ error: "insufficient_credits" }, { status: 402 });
    if (error instanceof PlanConflict)
      return Response.json({ error: "execution_conflict" }, { status: 409 });
    console.error(
      "[chirpy/plan] failed",
      error instanceof Error ? error.message : "unknown",
    );
    return Response.json({ error: "planning_failed" }, { status: 502 });
  }
}
