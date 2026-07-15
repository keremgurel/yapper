/**
 * Subscription + top-up catalog. The plan *shape* lives here; the actual Stripe
 * price IDs come from env so they can differ per environment and be swapped
 * without a deploy. Final prices/credit allotments are tuned on measured COGS
 * (see docs/product-vision.md §7); the numbers here are placeholders and the
 * Stripe price is the source of truth for the amount charged.
 *
 * To go live: create the products/prices in Stripe, then set the env vars.
 */

export type PlanKey = "starter" | "plus" | "pro";

/** 1 GiB in bytes, for the per-tier storage quotas below. */
const GB = 1024 * 1024 * 1024;

export interface SubscriptionPlan {
  key: PlanKey;
  name: string;
  /** Stripe price id (recurring). Empty string when unconfigured. */
  priceId: string;
  /** Credits granted on each successful billing period (and on trial start). */
  monthlyCredits: number;
  /**
   * Included media storage for this tier, in bytes. A hard cap: when a save
   * would exceed it the write is rejected and the user deletes clips or upgrades
   * (iCloud style). No metered overage. See storageQuotaFor.
   */
  storageBytes: number;
  /** Display-only; Stripe's price is authoritative for the charge. */
  priceLabel: string;
  /** Display-only storage line, e.g. "25 GB". */
  storageLabel: string;
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
    monthlyCredits: 100,
    storageBytes: 25 * GB,
    priceLabel: "$9.99/mo",
    storageLabel: "25 GB",
    blurb:
      "For creators finding their voice: a few videos a week with room to grow.",
  },
  {
    key: "plus",
    name: "Plus",
    priceId: process.env.STRIPE_PRICE_PLUS ?? "",
    monthlyCredits: 400,
    storageBytes: 150 * GB,
    priceLabel: "$24.99/mo",
    storageLabel: "150 GB",
    blurb: "For consistent posters: daily feedback and generation headroom.",
  },
  {
    key: "pro",
    name: "Pro",
    priceId: process.env.STRIPE_PRICE_PRO ?? "",
    monthlyCredits: 1000,
    storageBytes: 500 * GB,
    priceLabel: "$49.99/mo",
    storageLabel: "500 GB",
    blurb: "For power users: high-volume feedback, scripts, and storage.",
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
