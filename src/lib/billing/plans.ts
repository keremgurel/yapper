/**
 * Studio and Train are sold separately. Each plan and credit pack belongs to
 * one product and fills only that product's wallet.
 *
 * Studio: one Creator membership with three billing cadences. Keeping the
 * capabilities identical makes the decision about commitment, not which parts
 * of the product a creator is allowed to use.
 *
 * Train: one plan, Train Plus, which is unlimited AI feedback within a
 * fair-use ceiling.
 *
 * Price IDs are environment-specific. Stripe is the source of truth for the
 * amount charged; these labels are the matching product copy.
 */

import type { Product } from "./products";

export type PlanKey =
  | "creator_weekly"
  | "creator_monthly"
  | "creator_yearly"
  | "train_plus_monthly"
  | "train_plus_yearly";
export type BillingPeriod = "month" | "year";

/** Temporary publishing workspace, identical for every billing cadence.
 * This is concurrent capacity, never a weekly/monthly allocation or archive. */
export const TEMPORARY_STORAGE_BYTES = 5 * 1024 * 1024 * 1024;
export const TRIAL_CREDITS = 30;

export interface SubscriptionPlan {
  key: PlanKey;
  /** The wallet this plan fills and the product it unlocks. */
  product: Product;
  /** Whether a first-time subscriber starts with a card-backed free trial. */
  trial: boolean;
  /** What one month costs, in cents, at this cadence. Train plans only. */
  monthlyEquivalentCents?: number;
  name: string;
  cadence: "week" | "month" | "year";
  cadenceLabel: string;
  priceId: string;
  includedCredits: number;
  storageBytes: number;
  priceLabel: string;
  storageLabel: string;
  blurb: string;
  badge?: string;
}

export interface CreditPack {
  key: "credits_100" | "credits_300" | "credits_1000";
  product: Product;
  name: string;
  priceId: string;
  credits: number;
  priceLabel: string;
}

/** A card is collected before the trial starts; the first real charge is day 8. */
export const TRIAL_DAYS = 7;

export const STUDIO_PLANS: SubscriptionPlan[] = [
  {
    key: "creator_weekly",
    product: "studio",
    trial: true,
    name: "Weekly",
    cadence: "week",
    cadenceLabel: "per week",
    priceId: process.env.STRIPE_PRICE_CREATOR_WEEKLY ?? "",
    includedCredits: 100,
    storageBytes: TEMPORARY_STORAGE_BYTES,
    priceLabel: "$7.99",
    storageLabel: "5 GB temporary workspace",
    blurb:
      "Maximum flexibility. Pause or cancel whenever your posting rhythm changes.",
  },
  {
    key: "creator_monthly",
    product: "studio",
    trial: true,
    name: "Monthly",
    cadence: "month",
    cadenceLabel: "per month",
    priceId: process.env.STRIPE_PRICE_CREATOR_MONTHLY ?? "",
    includedCredits: 500,
    storageBytes: TEMPORARY_STORAGE_BYTES,
    priceLabel: "$24.99",
    storageLabel: "5 GB temporary workspace",
    blurb: "The best fit for creators posting consistently every week.",
    badge: "Most popular",
  },
  {
    key: "creator_yearly",
    product: "studio",
    trial: true,
    name: "Yearly",
    cadence: "year",
    cadenceLabel: "per year",
    priceId: process.env.STRIPE_PRICE_CREATOR_YEARLY ?? "",
    includedCredits: 6000,
    storageBytes: TEMPORARY_STORAGE_BYTES,
    priceLabel: "$199.99",
    storageLabel: "5 GB temporary workspace",
    blurb: "Pay once for a year. All 6,000 credits arrive after payment.",
    badge: "Save 33%",
  },
];

/**
 * Train Plus is unlimited AI feedback on recorded practice, bounded only by a
 * fair-use ceiling (see train-fair-use.ts). It grants no credits: the plan
 * itself is the entitlement. Practice (prompts, timer, recording) is free and
 * needs no plan.
 */
export const TRAIN_PLUS = {
  name: "Train Plus",
  monthlyCents: 900,
  description: "Unlimited feedback on the practice you already do.",
} as const;
export const ANNUAL_DISCOUNT_PERCENT = 20;

export const TRAIN_PLANS: SubscriptionPlan[] = (["month", "year"] as const).map(
  (cadence) => {
    const annual = cadence === "year";
    const priceCents = annual
      ? (TRAIN_PLUS.monthlyCents * 12 * (100 - ANNUAL_DISCOUNT_PERCENT)) / 100
      : TRAIN_PLUS.monthlyCents;
    return {
      key: `train_plus_${annual ? "yearly" : "monthly"}` as PlanKey,
      product: "train" as const,
      // The free first session is the trial. No card-backed trial period.
      trial: false,
      name: TRAIN_PLUS.name,
      cadence,
      cadenceLabel: `per ${cadence}`,
      priceId:
        process.env[
          `STRIPE_PRICE_TRAIN_PLUS_${annual ? "YEARLY" : "MONTHLY"}`
        ] ?? "",
      // Unlimited: nothing to grant on renewal.
      includedCredits: 0,
      // Train stores practice results, not video. No media quota is sold.
      storageBytes: 0,
      storageLabel: "",
      monthlyEquivalentCents: priceCents / (annual ? 12 : 1),
      priceLabel: formatPrice(priceCents),
      blurb: TRAIN_PLUS.description,
    };
  },
);

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  ...STUDIO_PLANS,
  ...TRAIN_PLANS,
];

export function plansFor(product: Product) {
  return SUBSCRIPTION_PLANS.filter((plan) => plan.product === product);
}

export const CREDIT_PACKS: CreditPack[] = [
  {
    key: "credits_100",
    product: "studio",
    name: "100 credits",
    priceId: process.env.STRIPE_PRICE_CREDITS_100 ?? "",
    credits: 100,
    priceLabel: "$9",
  },
  {
    key: "credits_300",
    product: "studio",
    name: "300 credits",
    priceId: process.env.STRIPE_PRICE_CREDITS_300 ?? "",
    credits: 300,
    priceLabel: "$19",
  },
  {
    key: "credits_1000",
    product: "studio",
    name: "1,000 credits",
    priceId: process.env.STRIPE_PRICE_CREDITS_1000 ?? "",
    credits: 1000,
    priceLabel: "$49",
  },
];

export function packsFor(product: Product) {
  return CREDIT_PACKS.filter((pack) => pack.product === product);
}

export function formatPrice(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: cents % 100 ? 2 : 0,
  }).format(cents / 100);
}

export function planByKey(key: string | null | undefined) {
  return SUBSCRIPTION_PLANS.find((plan) => plan.key === key);
}

export function planByPriceId(priceId: string | null | undefined) {
  if (!priceId) return undefined;
  return SUBSCRIPTION_PLANS.find(
    (plan) => plan.priceId && plan.priceId === priceId,
  );
}

export function packByPriceId(priceId: string | null | undefined) {
  if (!priceId) return undefined;
  return CREDIT_PACKS.find((pack) => pack.priceId && pack.priceId === priceId);
}
