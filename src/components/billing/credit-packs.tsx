"use client";

import { Show, SignInButton } from "@clerk/nextjs";
import { Loader2 } from "lucide-react";
import { CREDIT_PACKS } from "@/lib/billing/plans";

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
      <h2 className="sg-display text-2xl">Need more this month?</h2>
      <p className="mt-1 mb-4 text-sm leading-6" style={muted}>
        Top up any time. Credits stack on top of your monthly allotment.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        {CREDIT_PACKS.map((pack) => (
          <article
            key={pack.key}
            className="sg-card flex items-center justify-between gap-4 p-5"
          >
            <div>
              <p className="sg-display text-xl">{pack.name}</p>
              <p className="sg-label mt-0.5">{pack.priceLabel}</p>
            </div>
            <Show when="signed-in">
              <button
                type="button"
                onClick={() => onStart(pack.key)}
                disabled={pending !== null}
                className="sg-btn-ghost disabled:opacity-50"
              >
                {pending === pack.key ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Buy"
                )}
              </button>
            </Show>
            <Show when="signed-out">
              <SignInButton mode="modal" withSignUp>
                <button type="button" className="sg-btn-ghost">
                  Sign in
                </button>
              </SignInButton>
            </Show>
          </article>
        ))}
      </div>
    </div>
  );
}
