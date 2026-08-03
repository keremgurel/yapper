"use client";

import { Show, SignInButton } from "@clerk/nextjs";
import { Check, Loader2 } from "lucide-react";
import { SUBSCRIPTION_PLANS, TRIAL_DAYS } from "@/lib/billing/plans";

const muted = { color: "var(--sg-text-muted)" };

const FEATURES = [
  "Every AI editing and idea tool",
  "Audio, video, and full coaching",
  "Private media library and re-watch",
  "Cancel anytime in Stripe",
];

/** Subscription tier cards. Render-only: the parent owns the checkout call and
 * passes which key is pending. Signed-out users are prompted to sign in first
 * (the checkout API needs an authenticated user). */
export default function PricingCards({
  pending,
  onStart,
}: {
  pending: string | null;
  onStart: (key: string) => void;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {SUBSCRIPTION_PLANS.map((plan) => (
        <article key={plan.key} className="sg-card flex flex-col gap-5 p-6">
          <div>
            <h3 className="sg-display text-2xl">{plan.name}</h3>
            <div className="mt-1 flex items-end gap-2">
              <p className="sg-display text-4xl">{plan.priceLabel}</p>
              <p className="sg-label pb-1">{plan.cadenceLabel}</p>
            </div>
            {plan.badge ? (
              <span className="sg-chip mt-3 inline-flex">{plan.badge}</span>
            ) : null}
            <p className="sg-label mt-3">
              {plan.includedCredits.toLocaleString()} credits / {plan.cadence}
            </p>
            <p className="sg-label">{plan.storageLabel} storage</p>
          </div>
          <p className="text-sm leading-6" style={muted}>
            {plan.blurb}
          </p>
          <ul className="flex flex-col gap-2 text-sm">
            {FEATURES.map((f) => (
              <li key={f} className="flex items-center gap-2">
                <Check className="h-4 w-4 shrink-0 text-cyan-500" />
                {f}
              </li>
            ))}
          </ul>
          <div className="mt-auto">
            <Show when="signed-in">
              <button
                type="button"
                onClick={() => onStart(plan.key)}
                disabled={pending !== null}
                className="sg-btn-accent w-full justify-center disabled:opacity-50"
              >
                {pending === plan.key ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  `Try ${TRIAL_DAYS} days free`
                )}
              </button>
            </Show>
            <Show when="signed-out">
              <SignInButton mode="modal" withSignUp>
                <button
                  type="button"
                  className="sg-btn-accent w-full justify-center"
                >
                  Sign in to start
                </button>
              </SignInButton>
            </Show>
          </div>
        </article>
      ))}
    </div>
  );
}
