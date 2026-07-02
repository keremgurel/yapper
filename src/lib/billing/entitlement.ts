import type { BillingState } from "@/lib/db/billing";

// Stripe statuses that grant access. `past_due` keeps access during dunning
// (Stripe retries the payment); it flips to canceled/unpaid if it gives up,
// which cuts access. incomplete / canceled / unpaid are not entitled.
const ENTITLED_STATUSES = new Set(["trialing", "active", "past_due"]);

/** Whether the user may use premium (AI) actions: an active-enough Stripe
 * subscription or an in-progress trial. Credits meter usage *within* this. */
export function isEntitled(
  state: Pick<BillingState, "subscriptionStatus"> | null,
): boolean {
  return (
    !!state?.subscriptionStatus &&
    ENTITLED_STATUSES.has(state.subscriptionStatus)
  );
}

export function isTrialing(
  state: Pick<BillingState, "subscriptionStatus"> | null,
): boolean {
  return state?.subscriptionStatus === "trialing";
}
