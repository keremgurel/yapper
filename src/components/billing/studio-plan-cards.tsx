"use client";

import { useState } from "react";
import Link from "next/link";
import { Show, SignInButton, useAuth } from "@clerk/nextjs";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBillingStatus } from "@/hooks/use-billing-status";
import { STUDIO_PLANS, TRIAL_CREDITS, TRIAL_DAYS } from "@/lib/billing/plans";
import styles from "./pricing.module.css";

const FEATURES = [
  "Brain, Ideas and Lab, built around your voice",
  "Record with a built-in teleprompter",
  "One-click editing, transcript cuts and captions",
  "Cross-post and schedule to connected channels",
  "5 GB temporary publishing workspace",
];

/** One membership, with a choice of payment cadence. */
export default function StudioPlanCards({
  pending,
  onStart,
}: {
  pending: string | null;
  onStart: (key: string) => void;
}) {
  const [cadence, setCadence] = useState("month");
  const plan = STUDIO_PLANS.find((item) => item.cadence === cadence)!;
  const { isSignedIn } = useAuth();
  const { status } = useBillingStatus(isSignedIn === true);
  return (
    <article className={styles.membership}>
      <div className={styles.membershipDetails}>
        <h2 className="type-h2">Your next video starts here.</h2>
        <p>One place to take an idea all the way to a finished video.</p>
        <ul className={styles.planFeatures}>
          {FEATURES.map((item) => (
            <li key={item}>
              <Check size={16} aria-hidden="true" />
              {item}
            </li>
          ))}
        </ul>
      </div>
      <div className={styles.membershipCheckout}>
        <div
          className={styles.billingToggle}
          role="group"
          aria-label="Billing period"
        >
          {STUDIO_PLANS.map((item) => (
            <button
              key={item.key}
              type="button"
              aria-label={
                item.cadence === "year" ? "Yearly, save 33%" : "Monthly"
              }
              aria-pressed={cadence === item.cadence}
              disabled={pending !== null}
              onClick={() => setCadence(item.cadence)}
            >
              {item.name}
              {item.cadence === "year" && <span>Save 33%</span>}
            </button>
          ))}
        </div>
        <div
          className={styles.membershipPrice}
          aria-live="polite"
          aria-atomic="true"
        >
          <div className={styles.price}>
            <strong>{plan.priceLabel}</strong>
            <span>{plan.cadenceLabel}</span>
          </div>
          <p>
            {plan.includedCredits.toLocaleString()} credits after each{" "}
            {cadence === "year" ? "yearly" : "monthly"} payment.
          </p>
          {cadence === "year" && (
            <p>Paid yearly. All 6,000 credits arrive at once.</p>
          )}
        </div>
        <Show when="signed-in">
          {status?.entitled ? (
            <Button asChild className="w-full">
              <Link href="/studio/home">Open Studio</Link>
            </Button>
          ) : (
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
                `Start ${TRIAL_DAYS}-day trial`
              )}
            </Button>
          )}
        </Show>
        <Show when="signed-out">
          <SignInButton mode="modal" withSignUp>
            <Button className="w-full">Start {TRIAL_DAYS}-day trial</Button>
          </SignInButton>
        </Show>
        <p className={styles.membershipNote}>
          {TRIAL_CREDITS} trial credits. Cancel anytime.
        </p>
      </div>
    </article>
  );
}
