"use client";

import TrainingLayout from "@/app/training-layout";
import CreditPacks from "@/components/billing/credit-packs";
import CurrentPlanBanner from "@/components/billing/current-plan-banner";
import PricingCards from "@/components/billing/pricing-cards";
import { useCheckout } from "@/hooks/use-checkout";

const muted = { color: "var(--sg-text-muted)" };

const CREDIT_EXAMPLES = [
  [
    "3 credits",
    "Full AI feedback on one practice rep: your score and the reasoning, every grammar and word choice fix, better phrasing, and a clean version of your answer",
  ],
  ["1 credit", "Transcribe a recording on its own, without the coaching"],
] as const;

export default function PricingPage() {
  const { pending, error, startPlan, startPack } = useCheckout();
  const notLive =
    error === "not_configured" || error === "price_not_configured";

  return (
    <TrainingLayout>
      <section className="pt-16 pb-24 sm:pt-20">
        <div className="marketing-container">
          <span className="sg-chip">Pricing</span>
          <h1 className="sg-display mt-5 max-w-2xl text-4xl leading-[1.02] text-balance sm:text-5xl">
            Find out what your speaking actually sounds like
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-8" style={muted}>
            Every practice tool is free to use as often as you want. A
            membership is for the coaching. Every rep comes back scored, with
            the reasoning, your grammar and word choices corrected where they
            slipped, and a clean version of the answer you were reaching for.
            Start with a 7-day free trial; your card is charged only after it
            ends.
          </p>

          <div className="mt-8 flex flex-col gap-8">
            <CurrentPlanBanner />
            <PricingCards pending={pending} onStart={startPlan} />
            {error && (
              <p role="alert" className="text-destructive text-sm font-bold">
                {error === "already_subscribed"
                  ? "You already have an active membership. Use Manage billing to make changes."
                  : error === "subscription_required"
                    ? "Credit packs are available after you start a membership."
                    : notLive
                      ? "Billing isn't switched on yet. Check back shortly."
                      : "Could not start checkout. Please try again."}
              </p>
            )}
            <CreditPacks pending={pending} onStart={startPack} />
            <section className="sg-panel p-6 sm:p-8">
              <p className="sg-label">A meter you can understand</p>
              <h2 className="sg-display mt-2 text-2xl">What credits cover</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6" style={muted}>
                Practicing, recording and exporting stay free. Credits are spent
                only when Yapper calls a paid transcription or AI provider, and
                they are returned automatically if that work fails.
              </p>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {CREDIT_EXAMPLES.map(([cost, description]) => (
                  <div key={cost} className="bg-muted rounded-xl p-4">
                    <p className="font-display text-foreground font-bold">
                      {cost}
                    </p>
                    <p className="mt-1 text-sm leading-6" style={muted}>
                      {description}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </section>
    </TrainingLayout>
  );
}
