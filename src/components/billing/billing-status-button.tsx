"use client";

import Link from "next/link";
import { Coins, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBillingStatus } from "@/hooks/use-billing-status";

/** Persistent, compact billing state in Studio: the paywall is discoverable
 * before an action fails, and members can always see their remaining meter. */
export default function BillingStatusButton() {
  const { status, loading } = useBillingStatus();
  if (loading) return null;

  return (
    <Button asChild variant="outline" size="sm" className="h-8 px-2.5">
      <Link href="/pricing" className="no-underline">
        {status?.entitled ? (
          <>
            <Coins className="h-3.5 w-3.5" />
            <span className="text-xs">{status.balance} credits</span>
          </>
        ) : (
          <>
            <Sparkles className="h-3.5 w-3.5" />
            <span className="hidden text-xs sm:inline">Unlock AI</span>
          </>
        )}
      </Link>
    </Button>
  );
}
