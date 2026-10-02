"use client";

import { useState } from "react";
import { Show, SignInButton } from "@clerk/nextjs";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  STUDIO_PLANS,
  TRIAL_DAYS,
  ANNUAL_DISCOUNT_PERCENT,
  formatPrice,
  type BillingPeriod,
} from "@/lib/billing/plans";
import { USAGE_EXAMPLES } from "@/lib/billing/usage-examples";
import styles from "./pricing.module.css";

/** The three Studio tiers with a monthly or yearly switch. */
export default function StudioPlanCards({
  pending,
  onStart,
}: {
  pending: string | null;
  onStart: (key: string) => void;
}) {
  const [period, setPeriod] = useState<BillingPeriod>("month");
  const [exampleKey, setExampleKey] = useState<string>("workflow");
  const example = USAGE_EXAMPLES.find((item) => item.key === exampleKey)!;
  return (
    <>
      <div className={styles.controls}>
        <div
          className={styles.billingToggle}
          role="group"
          aria-label="Billing period"
        >
          <button
            type="button"
            aria-pressed={period === "month"}
            onClick={() => setPeriod("month")}
          >
            Monthly
          </button>
          <button
            type="button"
            aria-pressed={period === "year"}
            onClick={() => setPeriod("year")}
          >
            Yearly <span>Save {ANNUAL_DISCOUNT_PERCENT}%</span>
          </button>
        </div>
        <label className={styles.exampleSelect}>
          See what’s possible
          <select
            value={exampleKey}
            onChange={(event) => setExampleKey(event.target.value)}
          >
            {USAGE_EXAMPLES.map((item) => (
              <option key={item.key} value={item.key}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className={styles.plans}>
        {STUDIO_PLANS.filter((plan) => plan.cadence === period).map((plan) => (
          <article
            key={plan.tier}
            className={styles.plan}
            data-featured={plan.tier === "creator"}
          >
            <header>
              <h2>{plan.name}</h2>
              <p>{plan.blurb}</p>
            </header>
            <div className={styles.allowance}>
              <strong>{plan.monthlyCredits!.toLocaleString("en-US")}</strong>
              <span>credits / month</span>
            </div>
            <p className={styles.equivalent}>
              Up to{" "}
              <strong>
                {Math.floor(plan.monthlyCredits! / example.cost).toLocaleString(
                  "en-US",
                )}
              </strong>{" "}
              {example.unit}
              <br />
              <span>if used only for this workflow</span>
            </p>
            <div className={styles.price}>
              <strong>{formatPrice(plan.monthlyEquivalentCents!)}</strong>
              <span>/ month</span>
            </div>
            <p className={styles.billingNote}>
              {period === "year"
                ? `${plan.priceLabel} billed yearly. Credits arrive monthly.`
                : `${plan.priceLabel} billed monthly.`}
            </p>
            <Show when="signed-in">
              <Button
                type="button"
                className="w-full"
                variant={plan.tier === "creator" ? "default" : "outline"}
                disabled={pending !== null}
                onClick={() => onStart(plan.key)}
              >
                {pending === plan.key ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Opening checkout…
                  </>
                ) : (
                  `Try ${TRIAL_DAYS} days free`
                )}
              </Button>
            </Show>
            <Show when="signed-out">
              <SignInButton mode="modal" withSignUp>
                <Button
                  className="w-full"
                  variant={plan.tier === "creator" ? "default" : "outline"}
                >
                  Get {plan.name}
                </Button>
              </SignInButton>
            </Show>
            <ul className={styles.planFeatures}>
              <li>
                <Check size={15} />
                Every Studio AI tool, charged by usage
              </li>
              <li>
                <Check size={15} />
                Manual editing and recording use no credits
              </li>
              <li>
                <Check size={15} />
                {plan.storageLabel} video storage
              </li>
              <li>
                <Check size={15} />
                Add credits when you need them
              </li>
            </ul>
          </article>
        ))}
      </div>
    </>
  );
}
