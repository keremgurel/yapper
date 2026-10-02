import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import MarketingLayout from "@/components/marketing/marketing-layout";
import Breadcrumbs from "@/components/marketing/breadcrumbs";
import TrainFeedbackDemo from "@/components/marketing/train-feedback-demo";
import SpeakingGuides from "@/components/marketing/speaking-guides";
import { TrainingCta } from "@/components/marketing/product-sections";
import { GlassyButton } from "@/components/ui/glassy-button";
import { feedbackQuestions, feedbackSteps } from "@/data/train-feedback";
import {
  DIMENSION_BLURBS,
  DIMENSION_LABELS,
  TRAINING_DIMENSIONS,
} from "@/lib/training-feedback/types";
import { marketingMetadata } from "@/lib/marketing-metadata";
import { SITE_URL, safeJsonLdStringify } from "@/lib/json-ld";
import styles from "@/components/marketing/train-product.module.css";

const PATH = "/products/train/ai-feedback";
const TITLE = "AI speech coach: feedback on your speaking practice";
const DESCRIPTION =
  "Record a practice answer in Yapper Train and get AI feedback: a transcript, five scores, corrections in your own words and one thing to work on next. First session free.";

export const metadata = marketingMetadata(TITLE, DESCRIPTION, PATH);

export default function TrainFeedbackPage() {
  return (
    <MarketingLayout>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: safeJsonLdStringify({
            "@context": "https://schema.org",
            "@type": "WebPage",
            name: TITLE,
            url: `${SITE_URL}${PATH}`,
            description: DESCRIPTION,
            about: {
              "@type": "SoftwareApplication",
              "@id": `${SITE_URL}/products/train#software`,
              name: "Yapper Train",
              url: `${SITE_URL}/products/train`,
            },
          }),
        }}
      />
      <section className={styles.hero}>
        <div className="marketing-container">
          <Breadcrumbs
            items={[
              { label: "Yapper Train", href: "/products/train" },
              { label: "AI feedback", href: PATH },
            ]}
          />
          <div className={styles.feedbackGrid}>
            <div className={styles.feedbackCopy}>
              <h1 className="type-h1">An AI speech coach for your practice</h1>
              <p className="marketing-lede">
                Record an answer to any exercise. Yapper Train transcribes it,
                scores it, marks what to fix in your own words and gives you one
                thing to work on next.
              </p>
              <div className="marketing-actions">
                <GlassyButton href="/training" height={48}>
                  Start practicing
                </GlassyButton>
                <Link
                  className="marketing-text-link"
                  href="/products/train/pricing"
                >
                  Train pricing <ArrowUpRight size={15} aria-hidden="true" />
                </Link>
              </div>
              <p className="marketing-note">
                Your first feedback session is free.
              </p>
            </div>
            <TrainFeedbackDemo />
          </div>
        </div>
      </section>

      <section className="marketing-section marketing-rule">
        <div className="marketing-container">
          <h2 className="type-h2">What your answer is scored on</h2>
          <p className="type-description mt-4">
            Each of the five is scored from 0 to 100, with a short explanation
            of why.
          </p>
          <table className="marketing-comparison">
            <caption className="sr-only">
              The five things Yapper Train scores
            </caption>
            <tbody>
              {TRAINING_DIMENSIONS.map((dimension) => (
                <tr key={dimension}>
                  <th scope="row">{DIMENSION_LABELS[dimension]}</th>
                  <td>{DIMENSION_BLURBS[dimension]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="marketing-section marketing-rule">
        <div className="marketing-container">
          <h2 className="type-h2">How it works</h2>
          <div className="marketing-process">
            {feedbackSteps.map((step, index) => (
              <div key={step.title}>
                <span className="marketing-step-number">0{index + 1}</span>
                <h3 className="type-h3">{step.title}</h3>
                <p className="type-description">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="marketing-section marketing-rule">
        <div className="marketing-container">
          <h2 className="type-h2 mb-8">Questions about feedback</h2>
          <div className="marketing-faq">
            {feedbackQuestions.map((item) => (
              <details key={item.question}>
                <summary>{item.question}</summary>
                <p>{item.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
      <SpeakingGuides />
      <TrainingCta />
    </MarketingLayout>
  );
}
