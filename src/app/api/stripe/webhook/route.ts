import type Stripe from "stripe";
import type { NextRequest } from "next/server";
import { grantCreditsIdempotent } from "@/lib/db/credits";
import {
  applySubscriptionState,
  findUserIdByStripeCustomer,
  setStripeCustomerId,
} from "@/lib/db/billing";
import { getStripe } from "@/lib/stripe";
import {
  packByKey,
  planByKey,
  planByPriceId,
  TRIAL_CREDITS,
} from "@/lib/billing/plans";

import { allowanceSchedule } from "@/lib/billing/allowances";
import { grantDueAllowances } from "@/lib/db/subscription-allowances";

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

/** Checkout links the customer and grants a capped trial or a paid pack.
 * Paid subscription allowances are handled only by invoice.paid. */
async function onCheckoutCompleted(session: Stripe.Checkout.Session) {
  const userId = session.client_reference_id ?? session.metadata?.userId;
  if (!userId) return;
  const customerId =
    typeof session.customer === "string" ? session.customer : null;
  if (customerId) await setStripeCustomerId(userId, customerId);

  if (session.mode === "subscription") {
    const plan = planByKey(session.metadata?.plan);
    const subscriptionId =
      typeof session.subscription === "string"
        ? session.subscription
        : session.subscription?.id;
    if (!plan || !subscriptionId)
      throw new Error("unmapped_subscription_checkout");
    if (plan.legacy) {
      // Preserve outstanding old checkouts and their original idempotency key.
      await grantCreditsIdempotent(
        userId,
        plan.includedCredits,
        "subscription_grant",
        `sess_${session.id}`,
        { plan: plan.key, source: "checkout" },
      );
      return;
    }
    const subscription =
      await getStripe().subscriptions.retrieve(subscriptionId);
    if (subscription.status === "trialing") {
      // One small grant per account, even if checkout is retried or two sessions complete.
      await grantCreditsIdempotent(
        userId,
        TRIAL_CREDITS,
        "subscription_grant",
        `trial_${userId}`,
        { plan: plan.key, source: "trial" },
      );
    }
    // Paid allowance belongs exclusively to invoice.paid, including the first payment.

    return;
  }

  if (session.mode === "payment") {
    // Only grant once the money has actually cleared (async methods like ACH
    // fire completed while still "unpaid"; the paid state arrives later via
    // async_payment_succeeded, which we also route here).
    if (session.payment_status !== "paid") return;
    const pack = packByKey(session.metadata?.pack);
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
  // resolveUserId already falls back to the customer's metadata.userId, so a
  // null here means the customer genuinely isn't ours (a foreign/synthetic
  // event). Ignore it rather than 500-ing, which would make Stripe retry it
  // forever.
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

/** Paid creation/conversion/renewal. Never grants for a zero-dollar trial invoice
 * or a prorated plan change. Annual allowances are released monthly. */
async function onInvoicePaid(invoice: Stripe.Invoice) {
  if (
    invoice.status !== "paid" ||
    !["subscription_create", "subscription_cycle"].includes(
      invoice.billing_reason ?? "",
    )
  )
    return;
  const customerId =
    typeof invoice.customer === "string" ? invoice.customer : null;
  if (!customerId) return;
  const userId = await resolveUserId(customerId);
  if (!userId) return;
  const subRef = invoice.parent?.subscription_details?.subscription;
  const subscriptionId = typeof subRef === "string" ? subRef : subRef?.id;
  if (!subscriptionId) return;
  const subscription = await getStripe().subscriptions.retrieve(subscriptionId);
  if (subscription.status === "trialing") return;
  for (const line of invoice.lines.data) {
    const ref = line.pricing?.price_details?.price;
    const plan = planByPriceId(typeof ref === "string" ? ref : ref?.id);
    if (!plan || line.parent?.subscription_item_details?.proration) continue;
    // A late zero-dollar trial invoice must not turn into a second allowance.
    if (subscription.trial_end && line.period.end <= subscription.trial_end)
      return;
    if (plan.legacy) {
      if (invoice.billing_reason === "subscription_cycle")
        await grantCreditsIdempotent(
          userId,
          plan.includedCredits,
          "subscription_grant",
          `inv_${invoice.id}`,
          { plan: plan.key, source: "renewal" },
        );
      return;
    }
    const schedule = allowanceSchedule(
      plan,
      subscriptionId,
      line.period.start,
      line.period.end,
    );
    await grantDueAllowances(userId, schedule);
    return;
  }
  throw new Error(`unmapped_paid_invoice_${invoice.id}`);
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
