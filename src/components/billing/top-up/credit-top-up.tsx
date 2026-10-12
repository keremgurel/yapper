"use client";

import { useState } from "react";
import { Show, SignInButton, useAuth } from "@clerk/nextjs";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBillingStatus } from "@/hooks/use-billing-status";
import type { CreditPack } from "@/lib/billing/plans";
import CreditTank from "./credit-tank";
import PackChoice from "./pack-choice";
import { useBuyFromUrl } from "./use-buy-from-url";
import styles from "./top-up.module.css";

/**
 * One-time credit packs, shown as a tank filling to the balance a pack would
 * leave. Members see their own balance underneath the pack; everyone else
 * sees the pack on its own.
 */
export default function CreditTopUp({
  packs,
  pending,
  onStart,
}: {
  packs: CreditPack[];
  pending: string | null;
  onStart: (key: string) => void;
}) {
  const [choice, setChoice] = useState<CreditPack["key"]>(
    packs[1]?.key ?? packs[0].key,
  );
  const { isSignedIn, isLoaded } = useAuth();
  const { status, loading } = useBillingStatus(isSignedIn === true);
  const member = status?.entitled === true;
  const outsider = status !== null && !member;
  useBuyFromUrl(
    packs,
    isLoaded && (isSignedIn !== true || !loading),
    member,
    setChoice,
    onStart,
  );

  const pack = packs.find((p) => p.key === choice) ?? packs[0];
  const largest = Math.max(...packs.map((p) => p.credits));
  // A large balance would drown the pack, so the settled layer stops at one
  // largest pack's worth; the exact numbers are in the text beside it.
  const balance = member ? status.balance : null;
  const held = balance === null ? 0 : Math.min(balance, largest);
  const after = balance === null ? null : balance + pack.credits;

  return (
    <div className={styles.panel}>
      <div className={styles.gauge}>
        <CreditTank
          held={held}
          added={pack.credits}
          capacity={largest + (member ? largest : 0)}
        />
        <div className={styles.readout} aria-live="polite">
          <strong>+{pack.credits.toLocaleString()}</strong>
          <span>
            {after === null
              ? "credits"
              : `${balance!.toLocaleString()} now, ${after.toLocaleString()} after`}
          </span>
        </div>
      </div>
      <div className={styles.pick}>
        <PackChoice packs={packs} value={pack.key} onChange={setChoice} />
        <div className={styles.buy}>
          <Show when="signed-in">
            <Button
              type="button"
              size="lg"
              className="w-full"
              disabled={pending !== null || outsider}
              onClick={() => onStart(pack.key)}
            >
              {pending === pack.key ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Opening checkout…
                </>
              ) : (
                `Buy ${pack.credits.toLocaleString()} credits for ${pack.priceLabel}`
              )}
            </Button>
            {outsider && (
              <p className={styles.buyNote}>
                Packs add to a membership. Start your trial above first.
              </p>
            )}
          </Show>
          <Show when="signed-out">
            <SignInButton mode="modal" withSignUp>
              <Button type="button" size="lg" className="w-full">
                Sign in to add credits
              </Button>
            </SignInButton>
          </Show>
          <p className={styles.buyNote}>
            One payment. No renewal, and the credits never expire.
          </p>
        </div>
      </div>
    </div>
  );
}
