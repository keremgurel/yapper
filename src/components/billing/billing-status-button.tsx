"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Coins, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { siteContextFor } from "@/data/site-navigation";
import { useBillingStatus } from "@/hooks/use-billing-status";
import { TRAINING_FEEDBACK_CREDITS } from "@/lib/db/constants";

interface Meter {
  href: string;
  label: string;
  /** Members see a balance; everyone else sees an offer. */
  member: boolean;
}

type Status = NonNullable<ReturnType<typeof useBillingStatus>["status"]>;

/** Studio: the credit balance for members, the trial for everyone else. */
function studioMeter(status: Status): Meter {
  return status.entitled
    ? {
        href: "/products/studio/pricing",
        label: `${status.balance.toLocaleString()} credits`,
        member: true,
      }
    : {
        href: "/products/studio/pricing",
        label: "Start free trial",
        member: false,
      };
}

/** Train: the plan when there is one, otherwise how much feedback is left. */
function trainMeter(status: Status): Meter {
  const href = "/products/train/pricing";
  if (status.train?.unlimited)
    return { href, label: "Train Plus", member: true };
  const sessions = Math.floor(
    (status.train?.balance ?? 0) / TRAINING_FEEDBACK_CREDITS,
  );
  return sessions > 0
    ? {
        href,
        label: `${sessions} free feedback${sessions === 1 ? "" : "s"}`,
        member: true,
      }
    : { href, label: "Get Train Plus", member: false };
}

/**
 * Compact billing state in the header, for the product the visitor is in.
 * In Studio and on the brand pages it is the Studio credit balance; on Train
 * pages it is the Train plan or the feedback left. The paywall is discoverable
 * before an action fails, and members can always see what they have.
 */
export default function BillingStatusButton() {
  const pathname = usePathname();
  const { status, loading } = useBillingStatus();
  if (loading || !status) return null;
  const meter =
    siteContextFor(pathname) === "train"
      ? trainMeter(status)
      : studioMeter(status);

  return (
    <Button asChild variant="outline" size="sm" className="h-8 px-2.5">
      <Link href={meter.href} className="no-underline">
        {meter.member ? (
          <Coins className="h-3.5 w-3.5" aria-hidden="true" />
        ) : (
          <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
        )}
        <span className="text-xs">{meter.label}</span>
      </Link>
    </Button>
  );
}
