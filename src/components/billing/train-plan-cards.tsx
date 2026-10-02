"use client";

import { useState } from "react";
import Link from "next/link";
import { Show, SignInButton } from "@clerk/nextjs";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ANNUAL_DISCOUNT_PERCENT,
  TRAIN_PLANS,
  formatPrice,
  type BillingPeriod,
} from "@/lib/billing/plans";
import styles from "./pricing.module.css";

const FREE = [
  "Every exercise, prompt and timer",
  "Practice recording in your browser",
  "One AI feedback session when you sign up",
];
const PLUS = [
  "Unlimited AI feedback on your recordings",
  "Five scores, corrections and a clearer version of your answer",
  "Saved sessions and progress over time",
];

/** Free practice beside the one paid Train plan, with a billing switch. */
export default function TrainPlanCards({
  pending,
  onStart,
}: {
  pending: string | null;
  onStart: (key: string) => void;
}) {
  const [period, setPeriod] = useState<BillingPeriod>("month");
  const plan = TRAIN_PLANS.find((item) => item.cadence === period)!;
  return (
    <>
      <div className={`${styles.controls} ${styles.centerControls}`}>
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
      </div>
      <div className={styles.plansTwo}>
        <article className={styles.plan}>
          <header>
            <h2>Free practice</h2>
            <p>No account needed to start.</p>
          </header>
          <div className={styles.price} style={{ marginTop: 24 }}>
            <strong>$0</strong>
          </div>
          <p className={styles.billingNote}>
            Sign in only when you want feedback.
          </p>
          <Button asChild className="w-full" variant="outline">
            <Link href="/training">Start practicing</Link>
          </Button>
          <ul className={styles.planFeatures}>
            {FREE.map((item) => (
              <li key={item}>
                <Check size={15} aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
        </article>
        <article className={styles.plan} data-featured="true">
          <header>
            <h2>{plan.name}</h2>
            <p>{plan.blurb}</p>
          </header>
          <div className={styles.price} style={{ marginTop: 24 }}>
            <strong>{formatPrice(plan.monthlyEquivalentCents!)}</strong>
            <span>/ month</span>
          </div>
          <p className={styles.billingNote}>
            {period === "year"
              ? `${plan.priceLabel} billed yearly.`
              : `${plan.priceLabel} billed monthly.`}
          </p>
          <Show when="signed-in">
            <Button
              type="button"
              className="w-full"
              disabled={pending !== null}
              onClick={() => onStart(plan.key)}
            >
              {pending === plan.key ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Opening checkout…
                </>
              ) : (
                `Get ${plan.name}`
              )}
            </Button>
          </Show>
          <Show when="signed-out">
            <SignInButton mode="modal" withSignUp>
              <Button className="w-full">Get {plan.name}</Button>
            </SignInButton>
          </Show>
          <ul className={styles.planFeatures}>
            {PLUS.map((item) => (
              <li key={item}>
                <Check size={15} aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
        </article>
      </div>
    </>
  );
}
