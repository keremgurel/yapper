/**
 * Subscription + top-up catalog. The plan *shape* lives here; the actual Stripe
 * price IDs come from env so they can differ per environment and be swapped
 * without a deploy. Final prices/credit allotments are tuned on measured COGS
 * (see docs/product-vision.md §7); the numbers here are placeholders and the
 * Stripe price is the source of truth for the amount charged.
 *
 * To go live: create the products/prices in Stripe, then set the env vars.
 */

export type PlanKey = "starter" | "pro";

export interface SubscriptionPlan {
  key: PlanKey;
  name: string;
  /** Stripe price id (recurring). Empty string when unconfigured. */
  priceId: string;
  /** Credits granted on each successful billing period (and on trial start). */
  monthlyCredits: number;
  /** Display-only; Stripe's price is authoritative for the charge. */
  priceLabel: string;
  blurb: string;
}

export interface CreditPack {
  key: string;
  name: string;
  priceId: string;
  credits: number;
  priceLabel: string;
}

/** Free trial length, in days, applied to a new subscription. */
export const TRIAL_DAYS = 7;

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    key: "starter",
    name: "Starter",
    priceId: process.env.STRIPE_PRICE_STARTER ?? "",
    monthlyCredits: 50,
    priceLabel: "$12/mo",
    blurb:
      "For creators finding their voice: enough AI for a few videos a week.",
  },
  {
    key: "pro",
    name: "Pro",
    priceId: process.env.STRIPE_PRICE_PRO ?? "",
    monthlyCredits: 200,
    priceLabel: "$29/mo",
    blurb: "For consistent posters: daily feedback and generation headroom.",
  },
];

export const CREDIT_PACKS: CreditPack[] = [
  // Priced per-credit above the subscription rate on purpose: top-ups are the
  // convenience option, the subscription is the value option.
  {
    key: "pack_small",
    name: "20 credits",
    priceId: process.env.STRIPE_PRICE_PACK_SMALL ?? "",
    credits: 20,
    priceLabel: "$9",
  },
  {
    key: "pack_large",
    name: "60 credits",
    priceId: process.env.STRIPE_PRICE_PACK_LARGE ?? "",
    credits: 60,
    priceLabel: "$22",
  },
];

export function planByKey(key: string | null | undefined) {
  return SUBSCRIPTION_PLANS.find((p) => p.key === key);
}

export function planByPriceId(priceId: string | null | undefined) {
  if (!priceId) return undefined;
  return SUBSCRIPTION_PLANS.find((p) => p.priceId && p.priceId === priceId);
}

export function packByPriceId(priceId: string | null | undefined) {
  if (!priceId) return undefined;
  return CREDIT_PACKS.find((p) => p.priceId && p.priceId === priceId);
}
