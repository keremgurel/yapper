import { getBillingState } from "@/lib/db/billing";
import { isEntitled } from "@/lib/billing/entitlement";
import { stripeConfigured } from "@/lib/stripe";

/**
 * May this user run a premium (AI) action? This is the hard-paywall switch:
 * when Stripe is NOT configured, the paywall is off and everyone passes (the
 * credit-only model, so nothing breaks in keyless/local envs). Once Stripe is
 * configured, an active subscription or in-progress trial is required.
 *
 * Credits still meter usage on top of this (checked separately at deduct time).
 */
export async function canUsePremium(userId: string): Promise<boolean> {
  if (!stripeConfigured()) return true;
  return isEntitled(await getBillingState(userId));
}
