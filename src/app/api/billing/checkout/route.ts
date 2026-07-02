import { auth, currentUser } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import { getBillingState, setStripeCustomerId } from "@/lib/db/billing";
import { ensureUser } from "@/lib/db/users";
import { getStripe, stripeConfigured } from "@/lib/stripe";
import { CREDIT_PACKS, planByKey, TRIAL_DAYS } from "@/lib/billing/plans";

export const runtime = "nodejs";

/**
 * Start a Stripe Checkout: a subscription (with a free trial) for `{ plan }`, or
 * a one-time credit pack for `{ pack }`. We create/reuse the Stripe customer up
 * front and store its id, so subscription webhooks can map back to the user
 * even if they arrive before checkout.session.completed. Returns { url }.
 */
export async function POST(req: NextRequest): Promise<Response> {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!stripeConfigured()) {
    return Response.json({ error: "not_configured" }, { status: 503 });
  }
  await ensureUser(userId);

  const body = (await req.json().catch(() => ({}))) as {
    plan?: string;
    pack?: string;
  };
  const plan = planByKey(body.plan);
  const pack = CREDIT_PACKS.find((p) => p.key === body.pack);
  if (!plan && !pack) {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }

  const stripe = getStripe();
  const state = await getBillingState(userId);
  let customerId = state?.stripeCustomerId ?? null;
  if (!customerId) {
    const user = await currentUser();
    // Idempotency key keyed to the user so two concurrent checkouts can't
    // create two customers for the same person.
    const customer = await stripe.customers.create(
      {
        email: user?.primaryEmailAddress?.emailAddress ?? undefined,
        metadata: { userId },
      },
      { idempotencyKey: `cust-create-${userId}` },
    );
    customerId = customer.id;
    await setStripeCustomerId(userId, customerId);
  }

  // Only offer the free trial to users who have never had a subscription, so it
  // can't be farmed by cancel-and-resubscribe. subscriptionStatus is null until
  // the first subscription; any prior value (even "canceled") means no trial.
  const trialEligible = !state?.subscriptionStatus;

  const origin = new URL(req.url).origin;
  const common = {
    customer: customerId,
    client_reference_id: userId,
    success_url: `${origin}/studio?checkout=success`,
    cancel_url: `${origin}/pricing?checkout=cancel`,
  } as const;

  if (plan) {
    if (!plan.priceId) {
      return Response.json({ error: "price_not_configured" }, { status: 503 });
    }
    const session = await stripe.checkout.sessions.create({
      ...common,
      mode: "subscription",
      line_items: [{ price: plan.priceId, quantity: 1 }],
      subscription_data: {
        ...(trialEligible ? { trial_period_days: TRIAL_DAYS } : {}),
        metadata: { userId },
      },
      metadata: { userId, kind: "subscription", plan: plan.key },
      allow_promotion_codes: true,
    });
    return Response.json({ url: session.url });
  }

  // credit pack (mode: payment)
  if (!pack!.priceId) {
    return Response.json({ error: "price_not_configured" }, { status: 503 });
  }
  const session = await stripe.checkout.sessions.create({
    ...common,
    mode: "payment",
    line_items: [{ price: pack!.priceId, quantity: 1 }],
    metadata: { userId, kind: "pack", pack: pack!.key },
  });
  return Response.json({ url: session.url });
}
