"use client";

import Link from "next/link";
import {
  Lightbulb,
  FileText,
  Scissors,
  ImageIcon,
  Captions,
  Mic,
} from "lucide-react";
import MarketingLayout from "@/components/marketing/marketing-layout";
import CreditPacks from "@/components/billing/credit-packs";
import CurrentPlanBanner from "@/components/billing/current-plan-banner";
import StudioPlanCards from "@/components/billing/studio-plan-cards";
import CheckoutError from "@/components/billing/checkout-error";
import PricingFaq from "@/components/billing/pricing-faq";
import Breadcrumbs from "@/components/marketing/breadcrumbs";
import { useCheckout } from "@/hooks/use-checkout";
import { TRIAL_DAYS, TRIAL_CREDITS, packsFor } from "@/lib/billing/plans";
import { PAID_ACTIONS } from "@/lib/billing/credit-costs";
import { GENERATE_CREDITS } from "@/lib/db/constants";
import {
  WORKFLOW_EXAMPLE,
  WORKFLOW_CREDITS,
} from "@/lib/billing/usage-examples";
import styles from "./pricing.module.css";

const costs = [
  {
    icon: Lightbulb,
    title: "Capture an idea",
    cost: `${PAID_ACTIONS.capture_idea.credits} credits`,
    detail:
      "AI capture and categorization. Voice transcription is charged separately; saving a typed note is free.",
  },
  {
    icon: FileText,
    title: "Develop your script",
    cost: `${GENERATE_CREDITS.script} credits`,
    detail: `Per generated script. Hook alternatives and Chirpy script revisions are ${GENERATE_CREDITS.hooks} credit per request.`,
  },
  {
    icon: Scissors,
    title: "One-click edit",
    cost: `From ${PAID_ACTIONS.clean_transcript.credits} credits`,
    detail: `${PAID_ACTIONS.clean_transcript.credits} credits per 5 minutes of transcript cleanup. Add transcription if the video has no transcript yet.`,
  },
  {
    icon: ImageIcon,
    title: "Generate a thumbnail",
    cost: `${PAID_ACTIONS.publish_thumbnail.credits} credits`,
    detail:
      "Per AI-generated or remixed 2K image. Choosing a frame from your video uses no credits.",
  },
  {
    icon: Captions,
    title: "Write publishing copy",
    cost: `${PAID_ACTIONS.publish_caption.credits} credits`,
    detail:
      "Per generation request across your selected platforms, including titles, captions, and hashtags. Posting itself uses no credits.",
  },
  {
    icon: Mic,
    title: "Transcribe and subtitle",
    cost: `${PAID_ACTIONS.transcribe.credits} credits / min`,
    detail:
      "Rounded up to the next minute per submitted recording. Subtitle styling and export use the existing transcript at no extra credit cost.",
  },
];

const questions = [
  {
    question: "How do monthly and yearly plans work?",
    answer:
      "Both give you the same monthly allowance. Monthly plans bill each month. Yearly plans bill once for the year at 20% less, and credits are released on your monthly anniversary. Annual refills are processed daily, so one can arrive up to 24 hours after that anniversary.",
  },
  {
    question: "Does a Studio plan include Yapper Train?",
    answer:
      "No. Studio and Train are separate products with separate plans. Studio credits pay for Studio’s AI tools only. Train’s speaking practice is free, and its AI feedback has its own plan. One Yapper account signs you in to both.",
  },
  {
    question: "What happens to unused credits?",
    answer:
      "Unused credits stay in your Studio balance, including credit packs. They do not expire. You need an active plan or trial to spend them, and canceling stops new monthly allowances after your paid period ends.",
  },
  {
    question: "What can I do without spending credits?",
    answer:
      "Recording, the teleprompter, writing and saving ideas by hand, manual editing, styling existing subtitles, local export and posting use no credits. AI generation and cloud transcription spend credits. Cloud storage requires a plan.",
  },
  {
    question: "What if an AI action fails?",
    answer:
      "Credits are reserved before the work starts and returned if it fails, so you are not charged for a result you did not get. Transcription is settled on the actual length of the recording, and the difference is returned if it was shorter than reserved.",
  },
  {
    question: "What happens if I run out?",
    answer:
      "Add a one-time credit pack, or wait for your next allowance. Packs do not change your subscription or renew, and there are no automatic overage charges.",
  },
  {
    question: "Can I change or cancel my plan?",
    answer:
      "Use Manage billing to see available changes or cancel renewal. Stripe shows any prorated charge before you confirm. When you cancel, your access continues to the end of the paid period.",
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
              Pick a monthly credit allowance for Studio’s AI tools. Recording,
              manual editing and posting don’t use credits.
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
            <Link href="/products/studio#waitlist">Join the waitlist</Link>.
          </p>
          <CheckoutError error={error} productName="Studio" />
        </div>
      </section>
      <section className={styles.section}>
        <div className="marketing-container">
          <div className={styles.sectionHeading}>
            <h2 className="type-h2">What credits pay for</h2>
            <p>
              Every plan has the same tools. The allowance is the only
              difference, and you can spend it on any of them.
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
        <div className={`marketing-container ${styles.exampleLayout}`}>
          <div>
            <h2 className="type-h2">What does one video use?</h2>
            <p className="type-description mt-4">
              Here’s a 1-minute video, from a typed idea to publishing copy for
              three platforms. Use every step, or only the ones you need.
            </p>
            <p className={styles.exampleTotal}>
              <strong>{WORKFLOW_CREDITS}</strong> credits for this workflow
            </p>
            <p className={styles.small}>
              Includes one generation per step. Additional takes, images, and
              revisions use additional credits. Voice input adds transcription.
            </p>
          </div>
          <dl className={styles.breakdown}>
            {WORKFLOW_EXAMPLE.map((item) => (
              <div key={item.label}>
                <dt>{item.label}</dt>
                <dd>{item.cost}</dd>
              </div>
            ))}
            <div>
              <dt>Manual editing, subtitle styling, and posting</dt>
              <dd>0</dd>
            </div>
          </dl>
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
