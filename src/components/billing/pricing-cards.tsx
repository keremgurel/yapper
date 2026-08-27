"use client";

import { Show, SignInButton } from "@clerk/nextjs";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SUBSCRIPTION_PLANS, TRIAL_DAYS } from "@/lib/billing/plans";
import { TRAINING_FEEDBACK_CREDITS } from "@/lib/db/constants";

const muted = { color: "var(--sg-text-muted)" };

const FEATURES = [
  "A score on every rep, and the reasoning behind it",
  "Grammar, word choice and phrasing corrected line by line",
  "A clean version of the answer you were reaching for",
  "Your progress tracked across every session",
  "Cancel anytime in Stripe",
];

/** Subscription tier cards. Render-only: the parent owns the checkout call and
 * passes which key is pending. Signed-out users are prompted to sign in first
 * (the checkout API needs an authenticated user). Only the "Most popular" plan
 * gets the accent-filled button; one primary action per view. */
export default function PricingCards({
  pending,
  onStart,
}: {
  pending: string | null;
  onStart: (key: string) => void;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {SUBSCRIPTION_PLANS.map((plan) => {
        const featured = plan.badge === "Most popular";
        return (
          <article key={plan.key} className="sg-card flex flex-col gap-5 p-6">
            <div>
              <h3 className="sg-display text-2xl">{plan.name}</h3>
              <div className="mt-1 flex items-end gap-2">
                <p className="sg-display text-4xl">{plan.priceLabel}</p>
                <p className="sg-label pb-1">{plan.cadenceLabel}</p>
              </div>
              {plan.badge ? (
                <span
                  className="bg-muted mt-3 inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold"
                  style={muted}
                >
                  {plan.badge}
                </span>
              ) : null}
              <p className="sg-label mt-3">
                {plan.includedCredits.toLocaleString()} credits / {plan.cadence}
              </p>
              {/* Credits are the meter, but nobody buys a meter. The number
                  people actually compare is how many coached reps they get. */}
              <p className="sg-label">
                About{" "}
                {Math.floor(
                  plan.includedCredits / TRAINING_FEEDBACK_CREDITS,
                ).toLocaleString()}{" "}
                AI feedbacks
              </p>
              <p className="sg-label">{plan.storageLabel} video storage</p>
            </div>
            <p className="text-sm leading-6" style={muted}>
              {plan.blurb}
            </p>
            <ul className="flex flex-col gap-2 text-sm">
              {FEATURES.map((f) => (
                <li key={f} className="flex items-center gap-2">
                  <Check className="text-muted-foreground h-4 w-4 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            <div className="mt-auto">
              <Show when="signed-in">
                <Button
                  type="button"
                  onClick={() => onStart(plan.key)}
                  disabled={pending !== null}
                  variant={featured ? "default" : "outline"}
                  className="w-full"
                >
                  {pending === plan.key ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    `Try ${TRIAL_DAYS} days free`
                  )}
                </Button>
              </Show>
              <Show when="signed-out">
                <SignInButton mode="modal" withSignUp>
                  <Button
                    type="button"
                    variant={featured ? "default" : "outline"}
                    className="w-full"
                  >
                    Sign in to start
                  </Button>
                </SignInButton>
              </Show>
            </div>
          </article>
        );
      })}
    </div>
  );
}
