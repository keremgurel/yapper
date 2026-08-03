"use client";

import TrainingLayout from "@/app/training-layout";
import CreditPacks from "@/components/billing/credit-packs";
import CurrentPlanBanner from "@/components/billing/current-plan-banner";
import PricingCards from "@/components/billing/pricing-cards";
import { useCheckout } from "@/hooks/use-checkout";

const muted = { color: "var(--sg-text-muted)" };

const CREDIT_EXAMPLES = [
  [
    "1 credit",
    "Transcribe, capture an idea, clean an edit, place media, or write publish copy",
  ],
  [
    "2 credits",
    "Analyze a reference link or expand an idea into a creative direction",
  ],
  ["3 credits", "Write a full script or get detailed audio coaching"],
  [
    "4–8 credits",
    "Analyze a creator feed or run video and full on-camera coaching",
  ],
] as const;

export default function PricingPage() {
  const { pending, error, startPlan, startPack } = useCheckout();
  const notLive =
    error === "not_configured" || error === "price_not_configured";

  return (
    <TrainingLayout>
      <section className="px-4 pt-16 pb-24 sm:px-6 sm:pt-20 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <span className="sg-chip">Pricing</span>
          <h1 className="sg-display mt-5 max-w-2xl text-4xl leading-[1.02] text-balance sm:text-5xl">
            Go from idea to posted, faster
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-8" style={muted}>
            Edit manually for free. Creator membership unlocks every AI action,
            a private media library, and credits that meter the provider work
            fairly. Start with a 7-day free trial; your card is charged only
            after the trial.
          </p>

          <div className="mt-8 flex flex-col gap-8">
            <CurrentPlanBanner />
            <PricingCards pending={pending} onStart={startPlan} />
            {error && (
              <p role="alert" className="text-sm font-bold text-red-500">
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
                Manual editing and export stay free. Credits are reserved only
                when Yapper calls a paid AI, transcription, video-analysis, or
                scraping provider—and automatically returned if that work fails.
              </p>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {CREDIT_EXAMPLES.map(([cost, description]) => (
                  <div
                    key={cost}
                    className="border-border rounded-xl border p-4"
                  >
                    <p className="font-display text-foreground font-black">
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
