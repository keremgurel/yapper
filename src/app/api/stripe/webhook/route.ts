import type Stripe from "stripe";
import type { NextRequest } from "next/server";
import { grantCreditsIdempotent } from "@/lib/db/credits";
import {
  applySubscriptionState,
  findUserIdByStripeCustomer,
  setStripeCustomerId,
} from "@/lib/db/billing";
import { getStripe } from "@/lib/stripe";
import { CREDIT_PACKS, planByKey, planByPriceId } from "@/lib/billing/plans";

export const runtime = "nodejs";

/**
 * Stripe webhook. The subscription/customer state and every credit grant are
 * driven from here (Stripe is the source of truth). Grants are idempotent on a
 * Stripe id, so redelivered events never double-credit. Bad signature returns
 * 400; a handler failure returns 500 so Stripe retries (all non-2xx retry).
 */
export async function POST(req: NextRequest): Promise<Response> {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return Response.json({ error: "not_configured" }, { status: 500 });
  }

  const sig = req.headers.get("stripe-signature");
  if (!sig) return Response.json({ error: "no_signature" }, { status: 400 });

  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, sig, secret);
  } catch {
    return Response.json({ error: "bad_signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded":
        await onCheckoutCompleted(event.data.object);
        break;
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await onSubscriptionChange(event.data.object);
        break;
      case "invoice.paid":
        await onInvoicePaid(event.data.object);
        break;
      default:
        break; // ignore everything else
    }
  } catch (e) {
    // A handler failure is our bug, not Stripe's, so return 500 and let Stripe retry.
    console.error(`stripe webhook ${event.type} failed`, e);
    return Response.json({ error: "handler_failed" }, { status: 500 });
  }

  return Response.json({ received: true });
}

/** Signup / purchase: link the customer and grant the allotment (subscription,
 * incl. trial) or the credit pack. Keyed by the session id so it grants once. */
async function onCheckoutCompleted(session: Stripe.Checkout.Session) {
  const userId = session.client_reference_id ?? session.metadata?.userId;
  if (!userId) return;
  const customerId =
    typeof session.customer === "string" ? session.customer : null;
  if (customerId) await setStripeCustomerId(userId, customerId);

  if (session.mode === "subscription") {
    // Trial subscriptions are "no_payment_required"; the grant is expected at
    // signup either way (renewals come via invoice.paid).
    const plan = planByKey(session.metadata?.plan);
    if (plan && plan.monthlyCredits > 0) {
      await grantCreditsIdempotent(
        userId,
        plan.monthlyCredits,
        "subscription_grant",
        `sess_${session.id}`,
        { plan: plan.key, source: "checkout" },
      );
    }
    return;
  }

  if (session.mode === "payment") {
    // Only grant once the money has actually cleared (async methods like ACH
    // fire completed while still "unpaid"; the paid state arrives later via
    // async_payment_succeeded, which we also route here).
    if (session.payment_status !== "paid") return;
    const pack = CREDIT_PACKS.find((p) => p.key === session.metadata?.pack);
    if (!pack) {
      // Paid but unmappable: throw so Stripe retries and it's not lost silently.
      throw new Error(`unmapped credit pack for paid session ${session.id}`);
    }
    await grantCreditsIdempotent(
      userId,
      pack.credits,
      "purchase",
      `sess_${session.id}`,
      { pack: pack.key },
    );
  }
}

/** Mirror the subscription's status/plan/period into the user row. */
async function onSubscriptionChange(sub: Stripe.Subscription) {
  const customerId = typeof sub.customer === "string" ? sub.customer : null;
  if (!customerId) return;
  const userId = await resolveUserId(customerId);
  if (!userId) throw new Error(`no user for customer ${customerId}`);

  const priceId = sub.items.data[0]?.price?.id;
  const plan = planByPriceId(priceId);
  const periodEnd = sub.items.data[0]?.current_period_end;
  await applySubscriptionState(userId, {
    subscriptionStatus: sub.status,
    plan: plan?.key ?? null,
    currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
  });
}

/** Renewal: grant the monthly allotment on each paid cycle (not the initial
 * create invoice, which checkout.session.completed already covers). Idempotent
 * on the invoice id. */
async function onInvoicePaid(invoice: Stripe.Invoice) {
  if (invoice.billing_reason !== "subscription_cycle") return;
  const customerId =
    typeof invoice.customer === "string" ? invoice.customer : null;
  if (!customerId) return;
  const userId = await resolveUserId(customerId);
  if (!userId) throw new Error(`no user for customer ${customerId}`);

  // Scan every line for a plan price (a cycle invoice can lead with proration).
  let plan = undefined as ReturnType<typeof planByPriceId>;
  for (const line of invoice.lines.data) {
    const ref = line.pricing?.price_details?.price;
    const priceId = typeof ref === "string" ? ref : ref?.id;
    const match = planByPriceId(priceId);
    if (match) {
      plan = match;
      break;
    }
  }
  if (!plan || plan.monthlyCredits <= 0) return;
  await grantCreditsIdempotent(
    userId,
    plan.monthlyCredits,
    "subscription_grant",
    `inv_${invoice.id}`,
    { plan: plan.key, source: "renewal" },
  );
}

/** Map a Stripe customer to our user. Falls back to the customer's
 * metadata.userId (set at customer creation) if the id wasn't stored locally
 * (e.g. a lost create-customer race), and re-links it so future lookups hit. */
async function resolveUserId(customerId: string): Promise<string | null> {
  const known = await findUserIdByStripeCustomer(customerId);
  if (known) return known;
  try {
    const customer = await getStripe().customers.retrieve(customerId);
    if (customer.deleted) return null;
    const uid = customer.metadata?.userId;
    if (uid) {
      await setStripeCustomerId(uid, customerId);
      return uid;
    }
  } catch {
    // fall through
  }
  return null;
}
