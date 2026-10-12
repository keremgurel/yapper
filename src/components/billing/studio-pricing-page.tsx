"use client";

import { ImageIcon, Captions, Mic } from "lucide-react";
import MarketingLayout from "@/components/marketing/marketing-layout";
import CreditTopUp from "@/components/billing/top-up/credit-top-up";
import CurrentPlanBanner from "@/components/billing/current-plan-banner";
import StudioPlanCards from "@/components/billing/studio-plan-cards";
import CheckoutError from "@/components/billing/checkout-error";
import PricingFaq from "@/components/billing/pricing-faq";
import { useCheckout } from "@/hooks/use-checkout";
import { PAID_ACTIONS } from "@/lib/billing/paid-actions";
import {
  STUDIO_PLANS,
  TRIAL_DAYS,
  TRIAL_CREDITS,
  packsFor,
} from "@/lib/billing/plans";
import styles from "./pricing.module.css";

const credits = (n: number) => `${n.toLocaleString()} credits`;
const monthly = STUDIO_PLANS.find((plan) => plan.cadence === "month")!;
const yearly = STUDIO_PLANS.find((plan) => plan.cadence === "year")!;

// What Studio's paid actions cost, read from the live catalog.
const costs = [
  {
    icon: Mic,
    title: "Transcribe a recording",
    cost: `${credits(PAID_ACTIONS.transcribe.credits)} per 3 minutes`,
    detail:
      "Duration is checked before transcription, and partial blocks round up.",
  },
  {
    icon: ImageIcon,
    title: "Generate a thumbnail",
    cost: credits(PAID_ACTIONS.publish_thumbnail.credits),
    detail: "Choosing a frame from your video uses no credits.",
  },
  {
    icon: Captions,
    title: "Design an AI overlay",
    cost: credits(PAID_ACTIONS.design_overlay.credits),
    detail: `Design or revise one overlay, including up to three automatic quality checks. Generated pictures cost ${credits(PAID_ACTIONS.scene_image.credits)} each.`,
  },
];

const questions = [
  {
    question: "What changes when I pay yearly?",
    answer: `You get the same tools and 5 GB temporary workspace. Monthly billing is ${monthly.priceLabel} with ${credits(monthly.includedCredits)} per payment. Yearly billing is ${yearly.priceLabel} with all ${credits(yearly.includedCredits)} delivered after the annual payment, saving 33% compared with paying monthly for a year.`,
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
      <section className={styles.studioHero}>
        <div className="marketing-container">
          <div className={styles.studioIntro}>
            <h1 className="type-h1">One membership. Every Studio tool.</h1>
            <p>
              Choose monthly or yearly. Recording, manual edits and exporting
              don’t use credits. Use your included credits when you ask for AI.
            </p>
          </div>
          <div className={styles.membershipStack}>
            <CurrentPlanBanner product="studio" />
            <StudioPlanCards pending={pending} onStart={startPlan} />
          </div>
          <p className={styles.terms}>
            {TRIAL_DAYS}-day trial with {TRIAL_CREDITS} credits for eligible new
            subscribers. Card required.
            <br />
            Your selected plan is charged after the trial unless you cancel.
            Prices in USD, plus applicable tax.
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
      <section id="credits" className={styles.section}>
        <div className="marketing-container">
          <div className={styles.sectionHeading}>
            <h2 className="type-h2">Top up anytime</h2>
            <p>
              Running low before your next payment? Add a pack to your Studio
              balance.
            </p>
          </div>
          <CreditTopUp
            packs={packsFor("studio")}
            pending={pending}
            onStart={startPack}
          />
        </div>
      </section>
      <section className={styles.section}>
        <div className={`marketing-container ${styles.faqLayout}`}>
          <div>
            <h2 className="type-h2">Billing details</h2>
          </div>
          <PricingFaq items={questions} />
        </div>
      </section>
    </MarketingLayout>
  );
}
