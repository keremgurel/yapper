import type { BillingState } from "@/lib/db/billing";
import { FREE_STORAGE_BYTES } from "@/lib/db/constants";
import { isEntitled } from "@/lib/billing/entitlement";
import { planByKey } from "@/lib/billing/plans";

/**
 * A user's media-storage quota in bytes.
 *
 * An entitled subscriber (active, trialing, or within the dunning grace) gets
 * their tier's included storage; everyone else (free, lapsed, or on an unknown
 * plan key) gets the free-tier quota. This is a hard cap: when a save would
 * exceed it the caller rejects the write and the user deletes clips or upgrades.
 * There is no metered overage. Pure.
 */
export function storageQuotaFor(
  state: Pick<
    BillingState,
    "subscriptionStatus" | "plan" | "currentPeriodEnd"
  > | null,
  now: Date = new Date(),
): number {
  if (!isEntitled(state ?? null, now)) return FREE_STORAGE_BYTES;
  const plan = planByKey(state?.plan);
  return plan?.storageBytes ?? FREE_STORAGE_BYTES;
}
