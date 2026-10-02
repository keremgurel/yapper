"use client";

import { Show, SignInButton } from "@clerk/nextjs";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { STUDIO_PLANS, TRIAL_CREDITS, TRIAL_DAYS } from "@/lib/billing/plans";
import styles from "./pricing.module.css";

const FEATURES = [
  "Every Studio tool: ideas, scripts, teleprompter, editing, captions and publishing",
  "5 GB temporary publishing workspace",
  "Add a credit pack when you need more",
  "Cancel anytime in Stripe",
];

const PAYMENT = { week: "weekly", month: "monthly", year: "annual" } as const;

/** The Studio membership at its three billing cadences. Render-only: the
 * parent owns the checkout call and passes which key is pending. Only the
 * "Most popular" cadence gets the primary button. */
export default function StudioPlanCards({
  pending,
  onStart,
}: {
  pending: string | null;
  onStart: (key: string) => void;
}) {
  return (
    <div className={styles.plans}>
      {STUDIO_PLANS.map((plan) => {
        const featured = plan.badge === "Most popular";
        return (
          <article
            key={plan.key}
            className={styles.plan}
            data-featured={featured || undefined}
          >
            <header>
              <h2>{plan.name}</h2>
              <p>{plan.blurb}</p>
            </header>
            <div className={styles.price} style={{ marginTop: 24 }}>
              <strong>{plan.priceLabel}</strong>
              <span>{plan.cadenceLabel}</span>
            </div>
            <p className={styles.billingNote}>
              {plan.includedCredits.toLocaleString()} credits after each{" "}
              {PAYMENT[plan.cadence]} payment
              {plan.badge && !featured ? `. ${plan.badge}.` : "."}
            </p>
            <Show when="signed-in">
              <Button
                type="button"
                className="w-full"
                variant={featured ? "default" : "outline"}
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
            </Show>
            <Show when="signed-out">
              <SignInButton mode="modal" withSignUp>
                <Button
                  className="w-full"
                  variant={featured ? "default" : "outline"}
                >
                  Sign in to start
                </Button>
              </SignInButton>
            </Show>
            <ul className={styles.planFeatures}>
              <li>
                <Check size={15} aria-hidden="true" />
                {TRIAL_CREDITS} credits during your first {TRIAL_DAYS}-day trial
              </li>
              {FEATURES.map((item) => (
                <li key={item}>
                  <Check size={15} aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
          </article>
        );
      })}
    </div>
  );
}
