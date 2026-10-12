"use client";

import { Loader2 } from "lucide-react";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { useCheckout } from "@/hooks/use-checkout";
import { packsFor } from "@/lib/billing/plans";

const packs = packsFor("studio");

/** Credit packs as one-click menu items: each goes straight to Stripe. The
 * menu stays open while checkout opens so the spinner has somewhere to be. */
export default function QuickTopUp() {
  const { pending, error, startPack } = useCheckout();
  return (
    <div className="mt-3">
      <p className="text-muted-foreground mb-1.5 text-[11px] font-semibold">
        Add credits
      </p>
      <div className="grid grid-cols-3 gap-1.5">
        {packs.map((pack) => (
          <DropdownMenuItem
            key={pack.key}
            disabled={pending !== null}
            aria-label={`Buy ${pack.credits.toLocaleString()} credits for ${pack.priceLabel}`}
            onSelect={(event) => {
              event.preventDefault();
              startPack(pack.key);
            }}
            className="hover:bg-muted focus:bg-muted flex h-12 cursor-pointer flex-col items-center justify-center gap-0 rounded-lg border px-1 py-1 text-center"
          >
            {pending === pack.key ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <span className="text-[13px] font-semibold tabular-nums">
                  +{pack.credits.toLocaleString()}
                </span>
                <span className="text-muted-foreground text-[11px] tabular-nums">
                  {pack.priceLabel}
                </span>
              </>
            )}
          </DropdownMenuItem>
        ))}
      </div>
      {error && (
        <p role="alert" className="mt-2 text-[11px] text-red-500">
          {error === "subscription_required"
            ? "Packs add to an active membership."
            : "Could not open checkout. Try again."}
        </p>
      )}
    </div>
  );
}
