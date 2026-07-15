import { eq } from "drizzle-orm";
import { getDb } from "./client";
import { users } from "./schema";
import { storageQuotaFor } from "@/lib/billing/storage";

/** A user's Stripe/subscription state (the raw fields; entitlement is derived). */
export interface BillingState {
  stripeCustomerId: string | null;
  subscriptionStatus: string | null;
  plan: string | null;
  currentPeriodEnd: Date | null;
}

export async function getBillingState(
  userId: string,
): Promise<BillingState | null> {
  const [row] = await getDb()
    .select({
      stripeCustomerId: users.stripeCustomerId,
      subscriptionStatus: users.subscriptionStatus,
      plan: users.plan,
      currentPeriodEnd: users.currentPeriodEnd,
    })
    .from(users)
    .where(eq(users.id, userId));
  return row ?? null;
}

/** The user's media-storage quota (bytes), derived from their current plan and
 * entitlement. Free-tier quota when there is no active subscription. */
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
): Promise<void> {
  await getDb().update(users).set(s).where(eq(users.id, userId));
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
