/**
 * Studio and Train share one credit balance. Public offers bill monthly or
 * yearly; annual memberships release their allowance monthly. Legacy keys
 * remain readable for existing subscriptions, but are closed to new checkout.
 *
 * Price IDs are environment-specific. Stripe is the source of truth for the
 * amount charged; these labels are the matching product copy.
 */

export type PlanKey =
  | "creator_weekly"
  | "creator_monthly"
  | "creator_yearly"
  | `studio_${"starter" | "creator" | "pro"}_${"monthly" | "yearly"}`;
export type BillingPeriod = "month" | "year";

const GB = 1024 * 1024 * 1024;

export interface SubscriptionPlan {
  key: PlanKey;
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
  tier?: "starter" | "creator" | "pro";
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
    name: "100 credits",
    priceId: process.env.STRIPE_PRICE_CREDITS_100 ?? "",
    credits: 100,
    priceLabel: "$9",
  },
  {
    key: "credits_300",
    name: "300 credits",
    priceId: process.env.STRIPE_PRICE_CREDITS_300 ?? "",
    credits: 300,
    priceLabel: "$19",
  },
  {
    key: "credits_1000",
    name: "1,000 credits",
    priceId: process.env.STRIPE_PRICE_CREDITS_1000 ?? "",
    credits: 1000,
    priceLabel: "$49",
  },
];

export const TRIAL_CREDITS = 30;
export const ANNUAL_DISCOUNT_PERCENT = 20;

/** All tiers share tools; only the allowance and storage change. Separate IDs
 * prevent the launch catalog from repricing an existing Stripe subscription. */
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

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = MEMBERSHIP_TIERS.flatMap(
  (tier) =>
    (["month", "year"] as const).map((cadence) => {
      const annual = cadence === "year";
      const suffix = annual ? "YEARLY" : "MONTHLY";
      const priceCents = annual
        ? tier.monthlyCents * 12 * 0.8
        : tier.monthlyCents;
      return {
        key: `studio_${tier.key}_${annual ? "yearly" : "monthly"}` as PlanKey,
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

export const CREDIT_PACKS: CreditPack[] = [
  {
    key: "topup_100",
    name: "100 credits",
    credits: 100,
    priceCents: 1200,
    priceLabel: "$12",
    priceId: process.env.STRIPE_PRICE_TOPUP_100 ?? "",
  },
  {
    key: "topup_300",
    name: "300 credits",
    credits: 300,
    priceCents: 3000,
    priceLabel: "$30",
    priceId: process.env.STRIPE_PRICE_TOPUP_300 ?? "",
  },
  {
    key: "topup_1000",
    name: "1,000 credits",
    credits: 1000,
    priceCents: 9000,
    priceLabel: "$90",
    priceId: process.env.STRIPE_PRICE_TOPUP_1000 ?? "",
  },
];

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
