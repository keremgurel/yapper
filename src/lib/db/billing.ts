import { eq } from "drizzle-orm";
import { getDb } from "./client";
import { users } from "./schema";
import { storageQuotaFor } from "@/lib/billing/storage";
import { DEFAULT_PRODUCT, type Product } from "@/lib/billing/products";
import { subscriptionColumns } from "./wallet";

/** A user's Stripe/subscription state (the raw fields; entitlement is derived). */
export interface BillingState {
  stripeCustomerId: string | null;
  subscriptionStatus: string | null;
  plan: string | null;
  currentPeriodEnd: Date | null;
}

/** One product's subscription. The Stripe customer is shared by both. */
export async function getBillingState(
  userId: string,
  product: Product = DEFAULT_PRODUCT,
): Promise<BillingState | null> {
  const [row] = await getDb()
    .select({
      stripeCustomerId: users.stripeCustomerId,
      ...subscriptionColumns(product),
    })
    .from(users)
    .where(eq(users.id, userId));
  return row ?? null;
}

/** The user's media-storage quota (bytes), derived from their Studio plan and
 * entitlement. Train sells no storage. Free-tier quota when there is no active subscription. */
export async function getStorageQuota(userId: string): Promise<number> {
  return storageQuotaFor(await getBillingState(userId));
}

export async function setStripeCustomerId(
  userId: string,
  customerId: string,
): Promise<void> {
  await getDb()
    .update(users)
    .set({ stripeCustomerId: customerId })
    .where(eq(users.id, userId));
}

/** Sync the subscription fields from a Stripe webhook. Only the webhook writes
 * these, so the DB is a faithful mirror of Stripe (the source of truth). */
export async function applySubscriptionState(
  userId: string,
  s: {
    subscriptionStatus: string | null;
    plan: string | null;
    currentPeriodEnd: Date | null;
  },
  product: Product = DEFAULT_PRODUCT,
): Promise<void> {
  const values =
    product === "train"
      ? {
          trainSubscriptionStatus: s.subscriptionStatus,
          trainPlan: s.plan,
          trainCurrentPeriodEnd: s.currentPeriodEnd,
        }
      : s;
  await getDb().update(users).set(values).where(eq(users.id, userId));
}

export async function findUserIdByStripeCustomer(
  customerId: string,
): Promise<string | null> {
  const [row] = await getDb()
    .select({ id: users.id })
    .from(users)
    .where(eq(users.stripeCustomerId, customerId))
    .limit(1);
  return row?.id ?? null;
}
