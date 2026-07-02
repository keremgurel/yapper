"use client";

import { useEffect, useState } from "react";

export interface BillingStatus {
  entitled: boolean;
  trialing: boolean;
  status: string | null;
  plan: string | null;
  currentPeriodEnd: string | null;
  balance: number;
}

/** Fetches the signed-in user's billing snapshot once on mount. Returns null
 * while loading or when signed out (the API 401s). */
export function useBillingStatus() {
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetch("/api/billing/status")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!active) return;
        setStatus(d);
        setLoading(false);
      })
      .catch(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return { status, loading };
}
