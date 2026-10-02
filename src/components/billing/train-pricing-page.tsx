"use client";

import Link from "next/link";
import { Check } from "lucide-react";
import MarketingLayout from "@/components/marketing/marketing-layout";
import Breadcrumbs from "@/components/marketing/breadcrumbs";
import TrainFeedbackDemo from "@/components/marketing/train-feedback-demo";
import CheckoutError from "@/components/billing/checkout-error";
import CurrentPlanBanner from "@/components/billing/current-plan-banner";
import PricingFaq from "@/components/billing/pricing-faq";
import TrainPlanCards from "@/components/billing/train-plan-cards";
import { useCheckout } from "@/hooks/use-checkout";
import styles from "./pricing.module.css";

const session = [
  "A transcript of what you said, with filler words and pace measured",
  "Scores for clarity, grammar, vocabulary, delivery and impact",
  "Corrections marked in your own answer",
  "One thing to work on in your next attempt",
];

const questions = [
  {
    question: "What does unlimited mean?",
    answer:
      "Ask for feedback on as many recorded attempts as you like. It is meant for one person practicing, so we may limit automated or abusive use. Ordinary practice will not reach that limit.",
  },
  {
    question: "What do I get back?",
    answer:
      "A transcript, four scores, pronunciation, corrections in your own words and one thing to work on next. Practicing without asking for feedback is always free.",
  },
  {
    question: "What stays free?",
    answer:
      "Every exercise, the random topic generator, timers and recording in your browser. You don’t need an account for any of it. A new account also gets one feedback session at no cost.",
  },
  {
    question: "How do monthly and yearly billing work?",
    answer:
      "Both include the same thing. Monthly bills each month. Yearly bills once for the year at 20% less.",
  },
  {
    question: "Does Train Plus include Yapper Studio?",
    answer:
      "No. Studio is a separate product with its own plans and credits. One Yapper account signs you in to both, and each is billed on its own.",
  },
  {
    question: "Can I cancel?",
    answer:
      "Yes, from Manage billing. Your plan runs to the end of the period you paid for and does not renew. Your saved sessions stay in your account.",
  },
];

export default function TrainPricingPage() {
  const { pending, error, startPlan } = useCheckout();
  return (
    <MarketingLayout>
      <section className={styles.hero}>
        <div className="marketing-container">
          <Breadcrumbs
            items={[
              { label: "Yapper Train", href: "/products/train" },
              { label: "Pricing", href: "/products/train/pricing" },
            ]}
          />
          <div className={styles.intro}>
            <h1 className="type-h1">Yapper Train pricing</h1>
            <p>
              Speaking practice is free. Train Plus adds unlimited AI feedback
              on the attempts you record.
            </p>
          </div>
          <CurrentPlanBanner product="train" />
          <TrainPlanCards pending={pending} onStart={startPlan} />
          <p className={styles.terms}>
            Prices in USD, plus applicable tax. Renews until you cancel.
          </p>
          <CheckoutError error={error} productName="Train" />
        </div>
      </section>
      <section className={styles.section}>
        <div className={`marketing-container ${styles.included}`}>
          <TrainFeedbackDemo />
          <div>
            <h2 className="type-h2">What one session gives you</h2>
            <ul>
              {session.map((item) => (
                <li key={item}>
                  <Check size={16} aria-hidden="true" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <Link
              href="/products/train/ai-feedback"
              className="marketing-text-link mt-6"
            >
              How AI feedback works
            </Link>
          </div>
        </div>
      </section>
      <section className={styles.section}>
        <div className={`marketing-container ${styles.faqLayout}`}>
          <div>
            <h2 className="type-h2">Billing details</h2>
            <p className="type-description mt-4">
              Making videos instead?
              <br />
              <Link
                href="/products/studio/pricing"
                className="marketing-text-link"
              >
                See Yapper Studio pricing
              </Link>
            </p>
          </div>
          <PricingFaq items={questions} />
        </div>
      </section>
    </MarketingLayout>
  );
}
