"use client";

import Link from "next/link";
import { Loader2 } from "lucide-react";
import { planByKey } from "@/lib/billing/plans";
import { useBillingPortal } from "@/hooks/use-billing-portal";
import { useBillingStatus } from "@/hooks/use-billing-status";
import { formatStorageBytes } from "@/lib/storage/format";
import type { Product } from "@/lib/billing/products";
import { Button } from "@/components/ui/button";

/** Shown to one product's subscribers/trialers: that product's plan, what is
 * left in its wallet, and a button to the Stripe billing portal to manage or
 * cancel. Renders nothing otherwise. */
export default function CurrentPlanBanner({ product }: { product: Product }) {
  const { status } = useBillingStatus();
  const { opening, error, openPortal } = useBillingPortal();

  const mine = product === "train" ? status?.train : status;
  if (!status || !mine?.entitled) return null;
  const plan = planByKey(mine.plan);
  const cadence =
    plan?.cadence === "year"
      ? "yearly"
      : plan?.cadence === "week"
        ? "weekly"
        : "monthly";
  const label =
    product === "studio" && status.trialing
      ? "Free trial"
      : plan
        ? `${plan.product === "train" ? plan.name : "Studio Creator"} · ${cadence}`
        : "Subscribed";

  return (
    <div className="sg-panel flex flex-wrap items-center justify-between gap-3 p-5">
      <div>
        <p className="text-lg font-medium">{label}</p>
        {product === "train" ? (
          <p className="text-muted-foreground mt-1 text-sm">
            Unlimited AI feedback
          </p>
        ) : (
          <>
            <p className="text-muted-foreground mt-1 text-sm">
              {status.balance} Studio credits available
            </p>
            <p className="text-muted-foreground mt-1 text-sm">
              {formatStorageBytes(status.storageBytes)} of{" "}
              {formatStorageBytes(status.storageQuotaBytes)} temporary workspace
              used ·{" "}
              <Link
                href="/studio/storage"
                className="underline underline-offset-2"
              >
                View storage
              </Link>
            </p>
          </>
        )}
        {error && (
          <p role="alert" className="text-destructive mt-1 text-xs font-bold">
            Could not open the billing portal. Please try again.
          </p>
        )}
      </div>
      <Button
        type="button"
        variant="outline"
        onClick={() => void openPortal()}
        disabled={opening}
      >
        {opening ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />{" "}
            Opening billing…
          </>
        ) : (
          "Manage billing"
        )}
      </Button>
    </div>
  );
}
