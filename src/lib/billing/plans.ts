/**
 * Launch catalog: one Creator membership with three billing cadences. Keeping
 * the capabilities identical makes the decision about commitment, not which
 * parts of the product a creator is allowed to use.
 *
 * Price IDs are environment-specific. Stripe is the source of truth for the
 * amount charged; these labels are the matching product copy.
 */

export type PlanKey = "creator_weekly" | "creator_monthly" | "creator_yearly";

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
}

export interface CreditPack {
  key: "credits_100" | "credits_300" | "credits_1000";
  name: string;
  priceId: string;
  credits: number;
  priceLabel: string;
}

/** A card is collected before the trial starts; the first real charge is day 8. */
export const TRIAL_DAYS = 7;

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
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

export const CREDIT_PACKS: CreditPack[] = [
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
