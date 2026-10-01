"use client";
import Link from "next/link";
import {
  Lightbulb,
  FileText,
  Scissors,
  ImageIcon,
  Captions,
  Mic,
  Plus,
} from "lucide-react";
import MarketingLayout from "@/components/marketing/marketing-layout";
import CreditPacks from "@/components/billing/credit-packs";
import CurrentPlanBanner from "@/components/billing/current-plan-banner";
import PricingCards from "@/components/billing/pricing-cards";
import { useCheckout } from "@/hooks/use-checkout";
import { TRIAL_DAYS, TRIAL_CREDITS } from "@/lib/billing/plans";
import { PAID_ACTIONS } from "@/lib/billing/credit-costs";
import {
  GENERATE_CREDITS,
  TRAINING_FEEDBACK_CREDITS,
} from "@/lib/db/constants";
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

export default function PricingPage() {
  const { pending, error, startPlan, startPack } = useCheckout();
  const notLive = [
    "not_configured",
    "price_not_configured",
    "price_mismatch",
  ].includes(error ?? "");
  return (
    <MarketingLayout>
      <section className={styles.hero}>
        <div className="marketing-container">
          <div className={styles.intro}>
            <h1 className="type-h1">One plan. Your whole workflow.</h1>
            <p>
              Credits for your ideas, scripts, edits, and everything that comes
              next.
              <br className={styles.desktopBreak} /> Use them across Yapper
              Studio and Yapper Train.
            </p>
          </div>
          <CurrentPlanBanner />
          <PricingCards pending={pending} onStart={startPlan} />
          <p className={styles.terms}>
            {TRIAL_DAYS}-day trial with {TRIAL_CREDITS} credits for eligible new
            subscribers. Card required.
            <br />
            Your selected plan is charged after the trial unless you cancel.
            Prices in USD, plus applicable tax.
          </p>
          <p className={styles.access}>
            Studio is in private beta and requires an invitation.{" "}
            <Link href="/products/studio#waitlist">Join the waitlist</Link>.
            Train is available now.
          </p>
          {error && (
            <p className={styles.error} role="alert">
              {error === "already_subscribed"
                ? "You already have a membership. Use Manage billing to change your plan."
                : error === "subscription_required"
                  ? "Start a membership before buying additional credits."
                  : notLive
                    ? "These plans aren’t available for checkout yet. Please check back soon."
                    : "Could not start checkout. Please try again."}
            </p>
          )}
        </div>
      </section>
      <section className={styles.section}>
        <div className="marketing-container">
          <div className={styles.sectionHeading}>
            <h2 className="type-h2">Spend credits on what you create.</h2>
            <p>
              Every plan has the same tools. Your allowance is yours to mix and
              match.
            </p>
          </div>
          <div className={styles.costGrid}>
            {costs.map(({ icon: Icon, title, cost, detail }) => (
              <article className={styles.cost} key={title}>
                <Icon size={21} strokeWidth={1.5} />
                <h3>{title}</h3>
                <strong>{cost}</strong>
                <p>{detail}</p>
              </article>
            ))}
          </div>
          <div className={styles.trainRow}>
            <div>
              <h3>And keep getting better with Yapper Train.</h3>
              <p>
                One practice recording with scoring, corrections, and coaching.
              </p>
            </div>
            <strong>{TRAINING_FEEDBACK_CREDITS} credits / session</strong>
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
          <CreditPacks pending={pending} onStart={startPack} />
        </div>
      </section>
      <section className={styles.section}>
        <div className={`marketing-container ${styles.faqLayout}`}>
          <div>
            <h2 className="type-h2">A few useful details.</h2>
            <p className="type-description mt-4">
              Free practice is always here.
              <br />
              <Link href="/training" className="marketing-text-link">
                Start a speaking exercise
              </Link>
            </p>
          </div>
          <div className={styles.faq}>
            {[
              [
                "How do monthly and yearly plans work?",
                "Both give you the same monthly allowance. Monthly plans bill each month. Yearly plans bill once for the year at 20% less, with credits released on your monthly anniversary. Annual refills are processed daily and can arrive up to 24 hours after that anniversary.",
              ],
              [
                "Are Studio and Train separate subscriptions?",
                "No. Your plan provides one credit balance for AI features across both products. Studio is currently in private beta, so an invitation is still required to access it. Subscribing does not automatically provide a beta invitation.",
              ],
              [
                "What happens to unused credits?",
                "Unused credits remain in your balance, including credit packs. An active membership or valid trial is required to spend them on premium tools. Canceling does not create new monthly allowances after your paid period ends.",
              ],
              [
                "What can I do without spending credits?",
                "Record, use the teleprompter, write and save ideas, edit manually, style existing subtitles, and export locally without credit charges. Speaking prompts, timers, and local practice recording are free. AI generation and cloud transcription spend credits; cloud storage requires a membership.",
              ],
              [
                "What happens if I run out?",
                "Add a one-time credit pack, or wait for your next allowance. Packs do not change your subscription or renew automatically. There are no automatic credit overage charges.",
              ],
              [
                "Can I change or cancel my plan?",
                "Use Manage billing in your account to see available changes or cancel renewal. Stripe shows any prorated charge before you confirm a change. Your paid access continues through the end of the paid period when you cancel renewal.",
              ],
            ].map(([question, answer]) => (
              <details key={question}>
                <summary>
                  {question}
                  <Plus size={17} />
                </summary>
                <p>{answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
