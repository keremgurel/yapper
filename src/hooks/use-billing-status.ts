"use client";

import { STUDIO_RESOURCE_KEYS } from "@/lib/client-resource-cache";
import { useClientResource } from "@/hooks/use-client-resource";

export interface BillingStatus {
  entitled: boolean;
  trialing: boolean;
  status: string | null;
  plan: string | null;
  currentPeriodEnd: string | null;
  balance: number;
  storageBytes: number;
  storageQuotaBytes: number;
}

async function fetchBillingStatus(): Promise<BillingStatus | null> {
  try {
    const res = await fetch("/api/billing/status");
    // A 401 is the signed-out case, not a failure worth surfacing.
    return res.ok ? ((await res.json()) as BillingStatus) : null;
  } catch {
    return null;
  }
}

/**
 * The signed-in user's billing snapshot.
 *
 * Served from the shared resource cache because this hook lives in the Studio
 * header, which means it was refetching on every single navigation. The credit
 * balance is the one field that moves during a session, and the routes that
 * spend credits return the new balance themselves, so a stale-while-revalidate
 * read is right: the header shows the last known figure instantly and corrects
 * itself in the background.
 */
export function useBillingStatus() {
  const { data } = useClientResource(
    STUDIO_RESOURCE_KEYS.billing,
    true,
    fetchBillingStatus,
  );

  return { status: data ?? null, loading: data === null };
}
