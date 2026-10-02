import { getBillingState } from "@/lib/db/billing";
import { isEntitled } from "@/lib/billing/entitlement";
import { stripeConfigured } from "@/lib/stripe";
import { DEFAULT_PRODUCT, type Product } from "./products";

/**
 * May this user run a premium (AI) action? This is the hard-paywall switch:
 * when Stripe is NOT configured, only local/test environments may use the
 * credit-only model. Production fails closed. Once Stripe is
 * configured, an active subscription or in-progress trial for that product is
 * required. A Train plan never unlocks Studio, and the reverse.
 *
 * Credits still meter usage on top of this (checked separately at deduct time).
 */
export async function canUsePremium(
  userId: string,
  product: Product = DEFAULT_PRODUCT,
): Promise<boolean> {
  if (!stripeConfigured()) return process.env.NODE_ENV !== "production";
  return isEntitled(await getBillingState(userId, product));
}
