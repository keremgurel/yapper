"use client";

import { useState } from "react";

/** Starts a Stripe Checkout for a plan or credit pack and redirects to it.
 * Tracks which item is in flight (by key) so the clicked card can show a
 * spinner. One concern: kick off checkout and hand off to Stripe. */
export function useCheckout() {
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const go = async (body: { plan?: string; pack?: string }, key: string) => {
    setPending(key);
    setError(null);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as {
        url?: string;
        error?: string;
      };
      if (!res.ok || !data.url) {
        setError(data.error ?? "failed");
        setPending(null);
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("failed");
      setPending(null);
    }
  };

  return {
    pending,
    error,
    startPlan: (key: string) => go({ plan: key }, key),
    startPack: (key: string) => go({ pack: key }, key),
  };
}
