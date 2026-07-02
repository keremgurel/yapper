import { auth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import { getBillingState } from "@/lib/db/billing";
import { getStripe, stripeConfigured } from "@/lib/stripe";

export const runtime = "nodejs";

/** Open the Stripe billing portal so the user can manage/cancel their plan and
 * payment method. Returns { url }. */
export async function POST(req: NextRequest): Promise<Response> {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!stripeConfigured()) {
    return Response.json({ error: "not_configured" }, { status: 503 });
  }

  const state = await getBillingState(userId);
  if (!state?.stripeCustomerId) {
    return Response.json({ error: "no_customer" }, { status: 400 });
  }

  const origin = new URL(req.url).origin;
  const session = await getStripe().billingPortal.sessions.create({
    customer: state.stripeCustomerId,
    return_url: `${origin}/studio`,
  });
  return Response.json({ url: session.url });
}
