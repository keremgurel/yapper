"use client";

import { Show, SignInButton } from "@clerk/nextjs";
import { Loader2 } from "lucide-react";
import { CREDIT_PACKS } from "@/lib/billing/plans";
import { Button } from "@/components/ui/button";

const muted = { color: "var(--sg-text-muted)" };

/** One-time top-up packs, for when a subscriber runs out mid-month. Render-only.
 * (Only useful to subscribers, so the copy frames it as a top-up.) */
export default function CreditPacks({
  pending,
  onStart,
}: {
  pending: string | null;
  onStart: (key: string) => void;
}) {
  return (
    <div>
      <h2 className="type-h2">A little more room to create.</h2>
      <p className="mt-1 mb-4 text-sm leading-6" style={muted}>
        Add a one-time credit pack to your membership. No new subscription. No
        automatic top-ups. Unused credits stay in your balance.
      </p>
      <div className="grid gap-4 md:grid-cols-3">
        {CREDIT_PACKS.map((pack) => (
          <article key={pack.key} className="pricing-pack">
            <div>
              <p className="text-base font-medium">{pack.name}</p>
              <p className="mt-1 text-sm">{pack.priceLabel}</p>
            </div>
            <Show when="signed-in">
              <Button
                type="button"
                variant="outline"
                onClick={() => onStart(pack.key)}
                disabled={pending !== null}
              >
                {pending === pack.key ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Opening…
                  </>
                ) : (
                  "Buy credits"
                )}
              </Button>
            </Show>
            <Show when="signed-out">
              <SignInButton mode="modal" withSignUp>
                <Button type="button" variant="outline">
                  Sign in
                </Button>
              </SignInButton>
            </Show>
          </article>
        ))}
      </div>
    </div>
  );
}
