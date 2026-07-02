import type { BillingState } from "@/lib/db/billing";

// Stripe statuses that grant access. `past_due` keeps access during dunning
// (Stripe retries the payment); it flips to canceled/unpaid if it gives up,
// which cuts access. incomplete / canceled / unpaid are not entitled.
const ENTITLED_STATUSES = new Set(["trialing", "active", "past_due"]);

// Grace past the paid period before we cut access, covering dunning + webhook
// delay. Also the self-heal window if a cancellation webhook is ever missed.
const GRACE_MS = 3 * 24 * 60 * 60 * 1000;

/** Whether the user may use premium (AI) actions: an active-enough Stripe
 * subscription or an in-progress trial. Credits meter usage *within* this.
 *
 * We also require the paid period (plus grace) to still be current, so a missed
 * `customer.subscription.deleted` can't leave a user entitled forever. */
export function isEntitled(
  state: Pick<BillingState, "subscriptionStatus" | "currentPeriodEnd"> | null,
  now: Date = new Date(),
): boolean {
  if (!state?.subscriptionStatus) return false;
  if (!ENTITLED_STATUSES.has(state.subscriptionStatus)) return false;
  // No period recorded yet (just-created sub): trust the status. Otherwise the
  // period+grace must still be in the future.
  if (!state.currentPeriodEnd) return true;
  return now.getTime() < state.currentPeriodEnd.getTime() + GRACE_MS;
}

export function isTrialing(
  state: Pick<BillingState, "subscriptionStatus"> | null,
): boolean {
  return state?.subscriptionStatus === "trialing";
}
