import { auth } from "@clerk/nextjs/server";
import { getBillingState } from "@/lib/db/billing";
import { getBalance } from "@/lib/db/credits";
import { isEntitled, isTrialing } from "@/lib/billing/entitlement";

export const runtime = "nodejs";

/** The signed-in user's billing snapshot for the UI: are they entitled to
 * premium (AI) actions, on what plan, trialing, and how many credits are left. */
export async function GET(): Promise<Response> {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const state = await getBillingState(userId);
  const balance = await getBalance(userId);
  return Response.json({
    entitled: isEntitled(state),
    trialing: isTrialing(state),
    status: state?.subscriptionStatus ?? null,
    plan: state?.plan ?? null,
    currentPeriodEnd: state?.currentPeriodEnd ?? null,
    balance,
  });
}
