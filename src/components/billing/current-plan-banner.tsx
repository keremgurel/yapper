"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { planByKey } from "@/lib/billing/plans";
import { useBillingStatus } from "@/hooks/use-billing-status";

/** Shown to subscribers/trialers: current plan, credit balance, and a button to
 * the Stripe billing portal to manage or cancel. Renders nothing otherwise. */
export default function CurrentPlanBanner() {
  const { status } = useBillingStatus();
  const [opening, setOpening] = useState(false);

  if (!status?.entitled) return null;
  const plan = planByKey(status.plan);

  const manage = async () => {
    setOpening(true);
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as { url?: string };
      if (res.ok && data.url) {
        window.location.href = data.url;
        return;
      }
    } catch {
      // fall through
    }
    setOpening(false);
  };

  const label = status.trialing
    ? "Free trial"
    : plan
      ? `${plan.name} plan`
      : "Subscribed";

  return (
    <div className="sg-panel flex flex-wrap items-center justify-between gap-3 p-5">
      <div>
        <p className="sg-display text-lg">{label}</p>
        <p className="sg-label mt-0.5">{status.balance} credits available</p>
      </div>
      <button
        type="button"
        onClick={() => void manage()}
        disabled={opening}
        className="sg-btn-ghost disabled:opacity-50"
      >
        {opening ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          "Manage billing"
        )}
      </button>
    </div>
  );
}
