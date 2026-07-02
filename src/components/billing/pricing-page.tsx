"use client";

import TrainingLayout from "@/app/training-layout";
import CreditPacks from "@/components/billing/credit-packs";
import CurrentPlanBanner from "@/components/billing/current-plan-banner";
import PricingCards from "@/components/billing/pricing-cards";
import { useCheckout } from "@/hooks/use-checkout";

const muted = { color: "var(--sg-text-muted)" };

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
            The editor and tools are free forever. A subscription unlocks the
            AI: on-camera coaching, idea and script generation, and the guided
            create loop. Start with a 7-day free trial, cancel anytime.
          </p>

          <div className="mt-8 flex flex-col gap-8">
            <CurrentPlanBanner />
            <PricingCards pending={pending} onStart={startPlan} />
            {error && (
              <p role="alert" className="text-sm font-bold text-red-500">
                {notLive
                  ? "Billing isn't switched on yet. Check back shortly."
                  : "Could not start checkout. Please try again."}
              </p>
            )}
            <CreditPacks pending={pending} onStart={startPack} />
          </div>
        </div>
      </section>
    </TrainingLayout>
  );
}
