/**
 * Studio and Train are sold separately. Each plan and credit pack belongs to
 * one product and fills only that product's wallet. Public offers bill monthly
 * or yearly; annual memberships release their allowance monthly. Legacy keys
 * predate the split: they stay readable for existing subscriptions, keep the
 * shared balance they were sold with, and are closed to new checkout.
 *
 * Price IDs are environment-specific. Stripe is the source of truth for the
 * amount charged; these labels are the matching product copy.
 */

import type { Product } from "./products";

export type LegacyPlanKey =
  | "creator_weekly"
  | "creator_monthly"
  | "creator_yearly";
export type PlanKey =
  | LegacyPlanKey
  | `studio_${"starter" | "creator" | "pro"}_${"monthly" | "yearly"}`
  | `train_plus_${"monthly" | "yearly"}`;
export type BillingPeriod = "month" | "year";

const GB = 1024 * 1024 * 1024;

export interface SubscriptionPlan {
  key: PlanKey;
  /** The wallet this plan fills and the product it unlocks. */
  product: Product;
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
  /** Legacy prices remain resolvable for existing subscriptions only. */
  legacy?: boolean;
  tier?: "starter" | "creator" | "pro" | "plus";
  /** Whether a first-time subscriber starts with a card-backed free trial. */
  trial?: boolean;
  monthlyCredits?: number;
  priceCents?: number;
  monthlyEquivalentCents?: number;
}

export interface CreditPack {
  key:
    | "credits_100"
    | "credits_300"
    | "credits_1000"
    | "topup_100"
    | "topup_300"
    | "topup_1000";
  product: Product;
  legacy?: boolean;
  priceCents?: number;
  name: string;
  priceId: string;
  credits: number;
  priceLabel: string;
}

/** A card is collected before the trial starts; the first real charge is day 8. */
export const TRIAL_DAYS = 7;

export const LEGACY_SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    key: "creator_weekly",
    product: "studio",
    name: "Weekly",
    cadence: "week",
    cadenceLabel: "per week",
    priceId: process.env.STRIPE_PRICE_CREATOR_WEEKLY ?? "",
    includedCredits: 100,
    storageBytes: 25 * GB,
    priceLabel: "$7.99",
    storageLabel: "25 GB",
    blurb:
      "Maximum flexibility. Pause or cancel whenever your posting rhythm changes.",
  },
  {
    key: "creator_monthly",
    product: "studio",
    name: "Monthly",
    cadence: "month",
    cadenceLabel: "per month",
    priceId: process.env.STRIPE_PRICE_CREATOR_MONTHLY ?? "",
    includedCredits: 500,
    storageBytes: 50 * GB,
    priceLabel: "$24.99",
    storageLabel: "50 GB",
    blurb: "The best fit for creators posting consistently every week.",
    badge: "Most popular",
  },
  {
    key: "creator_yearly",
    product: "studio",
    name: "Yearly",
    cadence: "year",
    cadenceLabel: "per year",
    priceId: process.env.STRIPE_PRICE_CREATOR_YEARLY ?? "",
    includedCredits: 6000,
    storageBytes: 100 * GB,
    priceLabel: "$199.99",
    storageLabel: "100 GB",
    blurb:
      "Eight months of the monthly price, with a full year of creation headroom.",
    badge: "Save 33%",
  },
];

export const LEGACY_CREDIT_PACKS: CreditPack[] = [
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

export const TRIAL_CREDITS = 30;
export const ANNUAL_DISCOUNT_PERCENT = 20;

/** All Studio tiers share tools; only the allowance and storage change. Separate
 * IDs prevent the launch catalog from repricing an existing Stripe subscription. */
export const MEMBERSHIP_TIERS = [
  {
    key: "starter",
    name: "Starter",
    credits: 200,
    monthlyCents: 1900,
    storageGB: 20,
    description: "Room to find your rhythm.",
  },
  {
    key: "creator",
    name: "Creator",
    credits: 500,
    monthlyCents: 2900,
    storageGB: 50,
    description: "For a consistent publishing routine.",
  },
  {
    key: "pro",
    name: "Pro",
    credits: 1200,
    monthlyCents: 5900,
    storageGB: 100,
    description: "More room to create and experiment.",
  },
] as const;

export const STUDIO_PLANS: SubscriptionPlan[] = MEMBERSHIP_TIERS.flatMap(
  (tier) =>
    (["month", "year"] as const).map((cadence) => {
      const annual = cadence === "year";
      const suffix = annual ? "YEARLY" : "MONTHLY";
      const priceCents = annual
        ? tier.monthlyCents * 12 * 0.8
        : tier.monthlyCents;
      return {
        key: `studio_${tier.key}_${annual ? "yearly" : "monthly"}` as PlanKey,
        product: "studio" as const,
        trial: true,
        tier: tier.key,
        name: tier.name,
        cadence,
        cadenceLabel: `per ${cadence}`,
        priceId:
          process.env[
            `STRIPE_PRICE_STUDIO_${tier.key.toUpperCase()}_${suffix}`
          ] ?? "",
        includedCredits: tier.credits,
        monthlyCredits: tier.credits,
        storageBytes: tier.storageGB * GB,
        storageLabel: `${tier.storageGB} GB`,
        priceCents,
        monthlyEquivalentCents: priceCents / (annual ? 12 : 1),
        priceLabel: formatPrice(priceCents),
        blurb: tier.description,
      };
    }),
);

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

export const TRAIN_PLANS: SubscriptionPlan[] = (["month", "year"] as const).map(
  (cadence) => {
    const annual = cadence === "year";
    const priceCents = annual
      ? TRAIN_PLUS.monthlyCents * 12 * 0.8
      : TRAIN_PLUS.monthlyCents;
    return {
      key: `train_plus_${annual ? "yearly" : "monthly"}` as PlanKey,
      product: "train" as const,
      // The free first session is the trial. No card-backed trial period.
      trial: false,
      tier: "plus" as const,
      name: TRAIN_PLUS.name,
      cadence,
      cadenceLabel: `per ${cadence}`,
      priceId:
        process.env[
          `STRIPE_PRICE_TRAIN_PLUS_${annual ? "YEARLY" : "MONTHLY"}`
        ] ?? "",
      // Unlimited: nothing to grant on renewal.
      includedCredits: 0,
      monthlyCredits: 0,
      // Train stores practice results, not video. No media quota is sold.
      storageBytes: 0,
      storageLabel: "",
      priceCents,
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

const LEGACY_PLAN_KEYS = new Set<string>(
  LEGACY_SUBSCRIPTION_PLANS.map((plan) => plan.key),
);
/** Plans sold before the split included one balance for both products. */
export function isLegacyPlanKey(key: string | null | undefined) {
  return !!key && LEGACY_PLAN_KEYS.has(key);
}

export const CREDIT_PACKS: CreditPack[] = [
  {
    key: "topup_100",
    product: "studio",
    name: "100 credits",
    credits: 100,
    priceCents: 1200,
    priceLabel: "$12",
    priceId: process.env.STRIPE_PRICE_TOPUP_100 ?? "",
  },
  {
    key: "topup_300",
    product: "studio",
    name: "300 credits",
    credits: 300,
    priceCents: 3000,
    priceLabel: "$30",
    priceId: process.env.STRIPE_PRICE_TOPUP_300 ?? "",
  },
  {
    key: "topup_1000",
    product: "studio",
    name: "1,000 credits",
    credits: 1000,
    priceCents: 9000,
    priceLabel: "$90",
    priceId: process.env.STRIPE_PRICE_TOPUP_1000 ?? "",
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
  return (
    SUBSCRIPTION_PLANS.find((plan) => plan.key === key) ??
    LEGACY_SUBSCRIPTION_PLANS.map((plan) => ({ ...plan, legacy: true })).find(
      (plan) => plan.key === key,
    )
  );
}
export function planByPriceId(priceId: string | null | undefined) {
  if (!priceId) return undefined;
  return [
    ...SUBSCRIPTION_PLANS,
    ...LEGACY_SUBSCRIPTION_PLANS.map((plan) => ({ ...plan, legacy: true })),
  ].find((plan) => plan.priceId && plan.priceId === priceId);
}
export function packByKey(key: string | null | undefined) {
  return [
    ...CREDIT_PACKS,
    ...LEGACY_CREDIT_PACKS.map((pack) => ({ ...pack, legacy: true })),
  ].find((pack) => pack.key === key);
}
export function packByPriceId(priceId: string | null | undefined) {
  if (!priceId) return undefined;
  return [...CREDIT_PACKS, ...LEGACY_CREDIT_PACKS].find(
    (pack) => pack.priceId && pack.priceId === priceId,
  );
}
