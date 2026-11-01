import { withProductAnalytics } from "@/lib/analytics/server";
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
import { PlanConflict } from "@/lib/chirpy/ledger";
import { runStudioTurn } from "@/lib/chirpy/studio/turn";
import { parseStudioTurnInput } from "@/lib/chirpy/studio/wire";
import { sceneModelFailureReason } from "@/lib/studio/scene/scene-model-call";

export const runtime = "nodejs";
// Planning has a 40 s deadline; a new idea's first draft runs after it.
export const maxDuration = 180;

/** A Chirpy turn on a Studio tab: plan with the Studio catalog, run the
 * server actions, and answer with receipts and what to reload. */
async function trackedPOST(req: Request): Promise<Response> {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const ingress = await guardProviderIngress(req);
  if (ingress) return ingress;
  try {
    const input = parseStudioTurnInput(
      await readBoundedJson(req, { maxBytes: 64 * 1024 }),
    );
    if (!input) return Response.json({ error: "bad_request" }, { status: 400 });
    await ensureUser(userId);
    const reply = await runStudioTurn(userId, req, input, async () => {
      if (!(await canUsePremium(userId)))
        throw Response.json({ error: "not_entitled" }, { status: 402 });
      if (!process.env.SURPLUS_API_KEY)
        throw Response.json({ error: "no_provider" }, { status: 501 });
      const limited = await guardProviderSpend(req, userId, "chirpy-plan");
      if (limited) throw limited;
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
      "[chirpy/studio] failed",
      error instanceof Error ? error.message : "unknown",
    );
    const reason =
      error instanceof Error && error.message === "invalid_action_plan"
        ? "invalid_action_plan"
        : sceneModelFailureReason(error);
    return Response.json({ error: reason }, { status: 502 });
  }
}

export const POST = withProductAnalytics("chirpy_studio_turn", trackedPOST);
