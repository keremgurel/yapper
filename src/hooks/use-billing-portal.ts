"use client";

import { useState } from "react";

/** Opens the Stripe billing portal and redirects to it. Keeps the network call
 * out of the component (mirrors useCheckout). */
export function useBillingPortal() {
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState(false);

  const openPortal = async () => {
    setOpening(true);
    setError(false);
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as { url?: string };
      if (res.ok && data.url) {
        window.location.href = data.url;
        return;
      }
      setError(true);
    } catch {
      setError(true);
    }
    setOpening(false);
  };

  return { opening, error, openPortal };
}
