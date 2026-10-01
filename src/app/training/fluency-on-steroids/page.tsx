import type { Metadata } from "next";
import Link from "next/link";
import MarketingLayout from "@/components/marketing/marketing-layout";
import Breadcrumbs from "@/components/marketing/breadcrumbs";
import { GlassyButton } from "@/components/ui/glassy-button";
import { fluencyProtocol } from "@/data/training";

export const metadata: Metadata = {
  title: "12-minute speaking warm-up",
  description:
    "Four short exercises for a clear opening, controlled pace, vocal expression, and a concise summary before speaking practice.",
  alternates: {
    canonical: "https://ypr.app/training/fluency-on-steroids",
  },
};

export default function FluencyOnSteroidsPage() {
  return (
    <MarketingLayout>
      <section className="marketing-hero">
        <div className="marketing-container">
          <Breadcrumbs
            items={[
              { label: "Speaking practice", href: "/training" },
              {
                label: "Fluency warmup",
                href: "/training/fluency-on-steroids",
              },
            ]}
          />
          <h1 className="type-h1">A 12-minute speaking warmup.</h1>
          <p className="marketing-lede">{fluencyProtocol.description}</p>
          <p className="marketing-note">
            Free guide · {fluencyProtocol.cadence}
          </p>
          <div className="marketing-actions">
            <GlassyButton href="/training" height={46}>
              Start a practice session
            </GlassyButton>
            <Link
              href={fluencyProtocol.blogHref}
              className="marketing-text-link"
            >
              Read the full guide
            </Link>
          </div>
        </div>
      </section>
      <section className="marketing-section marketing-rule">
        <div className="marketing-container fluency-drills">
          {fluencyProtocol.drills.map((drill, index) => (
            <article key={drill.id}>
              <div className="fluency-drill-heading">
                <span>{index + 1}</span>
                <h2 className="type-h3">{drill.title}</h2>
                <span>{drill.duration}</span>
              </div>
              <p className="type-description">{drill.outcome}</p>
              <ol>
                {drill.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
              <p className="fluency-cue">{drill.cue}</p>
              <p className="marketing-note">Avoid: {drill.avoid}</p>
            </article>
          ))}
        </div>
      </section>
    </MarketingLayout>
  );
}
