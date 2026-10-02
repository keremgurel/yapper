import type Stripe from "stripe";
import type { NextRequest } from "next/server";
import { grantCreditsIdempotent, grantTrialCredits } from "@/lib/db/credits";
import {
  applySubscriptionState,
  findUserIdByStripeCustomer,
  setStripeCustomerId,
} from "@/lib/db/billing";
import { getStripe } from "@/lib/stripe";
import {
  CREDIT_PACKS,
  planByKey,
  planByPriceId,
  TRIAL_CREDITS,
} from "@/lib/billing/plans";
import { isProduct, type Product } from "@/lib/billing/products";

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

/** Link the customer; grant a limited trial or a paid credit pack. */
async function onCheckoutCompleted(session: Stripe.Checkout.Session) {
  const userId = session.client_reference_id ?? session.metadata?.userId;
  if (!userId) return;
  const customerId =
    typeof session.customer === "string" ? session.customer : null;
  if (customerId) await setStripeCustomerId(userId, customerId);

  if (session.mode === "subscription") {
    // Checkout grants only the small, once-per-account trial allowance.
    // Paid credits are tied to invoices, never to opening/completing checkout.
    // Only Studio plans carry a trial. Train Plus has none and no credits.
    if (
      session.payment_status === "no_payment_required" &&
      planByKey(session.metadata?.plan)?.trial
    ) {
      const subscriptionId =
        typeof session.subscription === "string"
          ? session.subscription
          : session.subscription?.id;
      if (subscriptionId) {
        const subscription =
          await getStripe().subscriptions.retrieve(subscriptionId);
        if (subscription.status === "trialing")
          await grantTrialCredits(userId, TRIAL_CREDITS);
      }
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
      pack.product,
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
  await applySubscriptionState(
    userId,
    {
      subscriptionStatus: sub.status,
      plan: plan?.key ?? null,
      currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
    },
    subscriptionProduct(sub, plan?.product),
  );
}

/** Which product's mirror a subscription event writes. The price is the best
 * evidence; checkout also stamps the product on the subscription so an event
 * for a retired price still lands in the right place. Subscriptions created
 * before the split carry neither and are Studio. */
function subscriptionProduct(
  sub: Stripe.Subscription,
  fromPlan: Product | undefined,
): Product {
  if (fromPlan) return fromPlan;
  const stamped = sub.metadata?.product;
  return isProduct(stamped) ? stamped : "studio";
}

/** Paid initial invoices and renewals each grant once. A zero-dollar trial
 * invoice grants nothing. Legacy initial invoices were credited at checkout. */
async function onInvoicePaid(invoice: Stripe.Invoice) {
  if (invoice.status !== "paid" || invoice.amount_paid <= 0) return;
  if (
    invoice.billing_reason !== "subscription_cycle" &&
    invoice.billing_reason !== "subscription_create"
  )
    return;
  const customerId =
    typeof invoice.customer === "string" ? invoice.customer : null;
  if (!customerId) return;
  const userId = await resolveUserId(customerId);
  if (!userId) return; // not our customer; ignore (see onSubscriptionChange)

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
  // An unlimited plan (Train Plus) carries no allowance. Its entitlement is
  // the subscription state mirrored by onSubscriptionChange.
  if (!plan || plan.includedCredits <= 0) return;
  let grantRef = `inv_${invoice.id}`;
  if (
    invoice.billing_reason === "subscription_create" &&
    invoice.parent?.subscription_details?.metadata?.creditGrantVersion !== "2"
  ) {
    // A checkout opened before this deployment can complete afterwards. Reuse
    // its old session grant key, so it neither loses credits nor double-grants
    // if the old webhook already delivered them.
    const ref = invoice.parent?.subscription_details?.subscription;
    const subscription = typeof ref === "string" ? ref : ref?.id;
    if (!subscription) return;
    const sessions = await getStripe().checkout.sessions.list({
      subscription,
      limit: 1,
    });
    const session = sessions.data[0];
    if (!session) throw new Error("initial_invoice_checkout_not_ready");
    grantRef = `sess_${session.id}`;
  }
  await grantCreditsIdempotent(
    userId,
    plan.includedCredits,
    "subscription_grant",
    grantRef,
    {
      plan: plan.key,
      source: "paid_invoice",
      billingReason: invoice.billing_reason,
    },
    plan.product,
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
