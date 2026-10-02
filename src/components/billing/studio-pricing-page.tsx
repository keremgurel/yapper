"use client";

import Link from "next/link";
import { ImageIcon, Captions, Mic } from "lucide-react";
import MarketingLayout from "@/components/marketing/marketing-layout";
import CreditPacks from "@/components/billing/credit-packs";
import CurrentPlanBanner from "@/components/billing/current-plan-banner";
import StudioPlanCards from "@/components/billing/studio-plan-cards";
import CheckoutError from "@/components/billing/checkout-error";
import PricingFaq from "@/components/billing/pricing-faq";
import Breadcrumbs from "@/components/marketing/breadcrumbs";
import { useCheckout } from "@/hooks/use-checkout";
import { TRIAL_DAYS, TRIAL_CREDITS, packsFor } from "@/lib/billing/plans";
import styles from "./pricing.module.css";

// What Studio's paid actions cost. These mirror the charges in
// src/lib/billing/actions.ts.
const costs = [
  {
    icon: Mic,
    title: "Transcribe a recording",
    cost: "4 credits per 3 minutes",
    detail:
      "Duration is checked before transcription, and partial blocks round up.",
  },
  {
    icon: ImageIcon,
    title: "Generate a thumbnail",
    cost: "12 credits",
    detail: "Choosing a frame from your video uses no credits.",
  },
  {
    icon: Captions,
    title: "Design an AI overlay",
    cost: "60 credits",
    detail:
      "Design or revise one overlay, including up to three automatic quality checks. Generated pictures cost 8 credits each.",
  },
];

const questions = [
  {
    question: "How do weekly, monthly and yearly differ?",
    answer:
      "They are the same membership with the same tools and the same 5 GB temporary workspace. The cadence changes how often you pay and how many credits arrive with each payment: 100 a week, 500 a month, or 6,000 once a year.",
  },
  {
    question: "Does a Studio membership include Yapper Train?",
    answer:
      "No. Studio and Train are separate products with separate plans. Studio credits pay for Studio’s AI tools only. Train’s speaking practice is free, and its AI feedback has its own plan. One Yapper account signs you in to both.",
  },
  {
    question: "What can I do without spending credits?",
    answer:
      "Practicing, recording and exporting stay free. Credits are spent only when Yapper calls a paid transcription or AI provider.",
  },
  {
    question: "What if an AI action fails?",
    answer:
      "Credits are returned automatically if the work fails, so you are not charged for a result you did not get.",
  },
  {
    question: "What happens if I run out?",
    answer:
      "Add a one-time credit pack, or wait for your next payment. Packs do not change your subscription or renew, and there are no automatic top-ups or overage charges.",
  },
  {
    question: "How does storage work?",
    answer:
      "Every membership has the same 5 GB temporary publishing workspace, and it does not accumulate. Published video files are released after the 24-hour retry window and the next cleanup run. Keep original files on your own device.",
  },
  {
    question: "Can I change or cancel my membership?",
    answer:
      "Use Manage billing to see available changes or cancel renewal. When you cancel, your access continues to the end of the paid period.",
  },
];

export default function StudioPricingPage() {
  const { pending, error, startPlan, startPack } = useCheckout();
  return (
    <MarketingLayout>
      <section className={styles.hero}>
        <div className="marketing-container">
          <Breadcrumbs
            items={[
              { label: "Yapper Studio", href: "/products/studio" },
              { label: "Pricing", href: "/products/studio/pricing" },
            ]}
          />
          <div className={styles.intro}>
            <h1 className="type-h1">Yapper Studio pricing</h1>
            <p>
              One membership with every Studio tool. Choose how often you pay.
              Practicing, recording and exporting don’t use credits.
            </p>
          </div>
          <CurrentPlanBanner product="studio" />
          <StudioPlanCards pending={pending} onStart={startPlan} />
          <p className={styles.terms}>
            {TRIAL_DAYS}-day trial with {TRIAL_CREDITS} credits for eligible new
            subscribers. Card required.
            <br />
            Your selected plan is charged after the trial unless you cancel.
            Prices in USD, plus applicable tax.
          </p>
          <p className={styles.access}>
            Studio is in private beta and requires an invitation. A plan does
            not include one.{" "}
            <Link href="/products/studio#waitlist">Apply for the beta</Link>.
          </p>
          <CheckoutError error={error} productName="Studio" />
        </div>
      </section>
      <section className={styles.section}>
        <div className="marketing-container">
          <div className={styles.sectionHeading}>
            <h2 className="type-h2">What credits pay for</h2>
            <p>
              Credits are spent only when Yapper calls a paid transcription or
              AI provider. Spend them on any tool.
            </p>
          </div>
          <div className={styles.costGrid}>
            {costs.map(({ icon: Icon, title, cost, detail }) => (
              <article className={styles.cost} key={title}>
                <Icon size={21} strokeWidth={1.5} aria-hidden="true" />
                <h3>{title}</h3>
                <strong>{cost}</strong>
                <p>{detail}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
      <section className={styles.section}>
        <div className="marketing-container">
          <CreditPacks
            packs={packsFor("studio")}
            heading="Add credits when you need them"
            note="A one-time pack for Studio subscribers. It doesn’t start a new subscription or renew, and unused credits stay in your Studio balance."
            action="Buy credits"
            pending={pending}
            onStart={startPack}
          />
        </div>
      </section>
      <section className={styles.section}>
        <div className={`marketing-container ${styles.faqLayout}`}>
          <div>
            <h2 className="type-h2">Billing details</h2>
            <p className="type-description mt-4">
              Looking for speaking practice instead?
              <br />
              <Link
                href="/products/train/pricing"
                className="marketing-text-link"
              >
                See Yapper Train pricing
              </Link>
            </p>
          </div>
          <PricingFaq items={questions} />
        </div>
      </section>
    </MarketingLayout>
  );
}
