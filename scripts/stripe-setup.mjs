#!/usr/bin/env node
/**
 * Create Yapper's Stripe products/prices + the webhook endpoint, idempotently.
 * Works in whichever mode the key belongs to (test or live).
 *
 * Usage (never commit or paste the live secret anywhere but here):
 *   STRIPE_SECRET_KEY=sk_live_xxx APP_URL=https://ypr.app node scripts/stripe-setup.mjs
 *
 * It prints the env vars to set. For LIVE, paste them into Vercel. For TEST,
 * paste into .env.local. The webhook signing secret is only shown once (now),
 * so copy it immediately.
 *
 * Adjust amounts/credits here (or edit the price in the Stripe dashboard, which
 * is authoritative for the charge). Keep in sync with src/lib/billing/plans.ts.
 */
import Stripe from "stripe";

const key = process.env.STRIPE_SECRET_KEY;
if (!key) {
  console.error("Set STRIPE_SECRET_KEY (test or live) in the environment.");
  process.exit(1);
}
const stripe = new Stripe(key);
const MODE = key.startsWith("sk_live") ? "LIVE" : "TEST";
const APP_URL = process.env.APP_URL ?? "https://ypr.app";

const PRICES = [
  {
    env: "STRIPE_PRICE_STARTER",
    name: "Yapper Starter",
    amount: 1200,
    recurring: true,
    idem: "yapper-starter",
  },
  {
    env: "STRIPE_PRICE_PRO",
    name: "Yapper Pro",
    amount: 2900,
    recurring: true,
    idem: "yapper-pro",
  },
  {
    env: "STRIPE_PRICE_PACK_SMALL",
    name: "Yapper 20 Credits",
    amount: 900,
    recurring: false,
    idem: "yapper-pack-small",
  },
  {
    env: "STRIPE_PRICE_PACK_LARGE",
    name: "Yapper 60 Credits",
    amount: 2200,
    recurring: false,
    idem: "yapper-pack-large",
  },
];

const WEBHOOK_EVENTS = [
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.paid",
];

const out = {};
for (const p of PRICES) {
  // Idempotency keeps re-runs within 24h from duplicating; after that Stripe
  // makes a fresh price (harmless, just archive the old one).
  const price = await stripe.prices.create(
    {
      unit_amount: p.amount,
      currency: "usd",
      ...(p.recurring ? { recurring: { interval: "month" } } : {}),
      product_data: { name: p.name },
    },
    { idempotencyKey: `${p.idem}-${MODE.toLowerCase()}` },
  );
  out[p.env] = price.id;
  console.error(`  ${p.name}: ${price.id}`);
}

const url = `${APP_URL}/api/stripe/webhook`;
const existing = (await stripe.webhookEndpoints.list({ limit: 100 })).data.find(
  (w) => w.url === url,
);
let whsec = null;
if (existing) {
  console.error(
    `  webhook already exists for ${url} (${existing.id}); reset its secret in the dashboard if you need it`,
  );
} else {
  const wh = await stripe.webhookEndpoints.create({
    url,
    enabled_events: WEBHOOK_EVENTS,
  });
  whsec = wh.secret;
  console.error(`  webhook created: ${wh.id}`);
}

console.log(
  `\n# ${MODE} mode. Set these (Vercel for LIVE, .env.local for TEST):`,
);
for (const [k, v] of Object.entries(out)) console.log(`${k}=${v}`);
if (whsec) console.log(`STRIPE_WEBHOOK_SECRET=${whsec}`);
console.log(
  `# NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=<your ${MODE.toLowerCase()} pk_...>`,
);
console.log(`# STRIPE_SECRET_KEY=<your ${MODE.toLowerCase()} sk_...>`);
