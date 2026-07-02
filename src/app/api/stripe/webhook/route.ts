import type Stripe from "stripe";
import type { NextRequest } from "next/server";
import { grantCreditsIdempotent } from "@/lib/db/credits";
import {
  applySubscriptionState,
  findUserIdByStripeCustomer,
  setStripeCustomerId,
} from "@/lib/db/billing";
import { getStripe } from "@/lib/stripe";
import { packByPriceId, planByKey, planByPriceId } from "@/lib/billing/plans";

export const runtime = "nodejs";

/**
 * Stripe webhook. The subscription/customer state and every credit grant are
 * driven from here (Stripe is the source of truth). Grants are idempotent on a
 * Stripe id, so redelivered events never double-credit. Always 200 on handled
 * events; 400 only on a bad signature (so Stripe retries real failures).
 */
export async function POST(req: NextRequest): Promise<Response> {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret)
    return Response.json({ error: "not_configured" }, { status: 500 });

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

/** Signup: link the customer and grant the initial allotment (covers the trial)
 * or the purchased credit pack. Keyed by the session id so it grants once. */
async function onCheckoutCompleted(session: Stripe.Checkout.Session) {
  const userId = session.client_reference_id ?? session.metadata?.userId;
  if (!userId) return;
  const customerId =
    typeof session.customer === "string" ? session.customer : null;
  if (customerId) await setStripeCustomerId(userId, customerId);

  if (session.mode === "subscription") {
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
  } else if (session.mode === "payment") {
    // Credit pack: quantity may exceed 1, so multiply per-pack credits.
    const line = await firstLineItem(session);
    const pack = packByPriceId(priceIdOf(line));
    if (pack) {
      const qty = line?.quantity ?? 1;
      await grantCreditsIdempotent(
        userId,
        pack.credits * qty,
        "purchase",
        `sess_${session.id}`,
        { pack: pack.key, qty },
      );
    }
  }
}

/** Mirror the subscription's status/plan/period into the user row. */
async function onSubscriptionChange(sub: Stripe.Subscription) {
  const customerId = typeof sub.customer === "string" ? sub.customer : null;
  if (!customerId) return;
  const userId = await findUserIdByStripeCustomer(customerId);
  if (!userId) return;

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
  const userId = await findUserIdByStripeCustomer(customerId);
  if (!userId) return;

  const priceRef = invoice.lines.data[0]?.pricing?.price_details?.price;
  const priceId = typeof priceRef === "string" ? priceRef : priceRef?.id;
  const plan = planByPriceId(priceId);
  if (!plan || plan.monthlyCredits <= 0) return;
  await grantCreditsIdempotent(
    userId,
    plan.monthlyCredits,
    "subscription_grant",
    `inv_${invoice.id}`,
    { plan: plan.key, source: "renewal" },
  );
}

// --- helpers ---

function priceIdOf(line: Stripe.LineItem | undefined): string | undefined {
  return line?.price?.id;
}

async function firstLineItem(
  session: Stripe.Checkout.Session,
): Promise<Stripe.LineItem | undefined> {
  const items = await getStripe().checkout.sessions.listLineItems(session.id, {
    limit: 1,
  });
  return items.data[0];
}
