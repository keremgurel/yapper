import Link from "next/link";
import { notFound } from "next/navigation";
import { Check } from "lucide-react";
import MarketingLayout from "@/components/marketing/marketing-layout";
import Breadcrumbs from "@/components/marketing/breadcrumbs";
import FeaturePreview from "@/components/marketing/feature-preview";
import {
  StudioSignup,
  TrainingCta,
} from "@/components/marketing/product-sections";
import { Button } from "@/components/ui/button";
import {
  getMarketingFeature,
  marketingFeatures,
} from "@/data/marketing-features";
import { featureDetails } from "@/data/feature-details";
import { relatedFeatures } from "@/data/marketing-resources";
import SpeakingGuides from "@/components/marketing/speaking-guides";
import { marketingMetadata } from "@/lib/marketing-metadata";
import { SITE_URL, safeJsonLdStringify } from "@/lib/json-ld";

export function generateStaticParams() {
  return marketingFeatures.map(({ slug }) => ({ slug }));
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const feature = getMarketingFeature(slug);
  return feature
    ? marketingMetadata(
        feature.seoTitle,
        feature.seoDescription,
        `/features/${slug}`,
      )
    : {};
}
export default async function FeaturePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const feature = getMarketingFeature(slug);
  const detail = featureDetails[slug];
  if (!feature || !detail) notFound();
  const training = slug === "creator-feedback";
  const product = training ? "train" : "studio";
  const related = relatedFeatures[slug] ?? [];
  return (
    <MarketingLayout>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: safeJsonLdStringify({
            "@context": "https://schema.org",
            "@type": "WebPage",
            name: feature.seoTitle,
            url: `${SITE_URL}/features/${slug}`,
            description: feature.seoDescription,
            about: {
              "@type": "SoftwareApplication",
              "@id": `${SITE_URL}/products/${product}#software`,
              name: training ? "Yapper Train" : "Yapper Studio",
              url: `${SITE_URL}/products/${product}`,
            },
          }),
        }}
      />
      <section className="marketing-hero">
        <div className="marketing-container">
          <Breadcrumbs
            items={[
              {
                label: training ? "Yapper Train" : "Yapper Studio",
                href: `/products/${product}`,
              },
              ...(!training ? [{ label: "Features", href: "/features" }] : []),
              { label: feature.shortTitle, href: `/features/${slug}` },
            ]}
          />
          <div className="marketing-feature-hero">
            <div>
              <h1 className="type-h1">{feature.title}</h1>
              <p className="marketing-lede">{feature.description}</p>
              <div className="marketing-actions">
                <Button asChild>
                  <Link href={training ? "/training" : "#waitlist"}>
                    {training ? "Start practicing" : "Join the Studio waitlist"}
                  </Link>
                </Button>
              </div>
              <p className="marketing-note">
                {training
                  ? "Free practice. AI coaching uses credits."
                  : "In private testing."}
              </p>
            </div>
            <FeaturePreview slug={slug} />
          </div>
        </div>
      </section>
      <section className="marketing-section marketing-rule">
        <div className="marketing-container marketing-split">
          <div>
            <h2 className="type-h2">{detail.heading}</h2>
            <p className="type-description">{detail.explanation}</p>
          </div>
          <ul className="marketing-benefits">
            {feature.highlights.map((highlight) => (
              <li key={highlight}>
                <Check size={16} />
                {highlight}
              </li>
            ))}
          </ul>
        </div>
      </section>
      <section className="marketing-section marketing-rule">
        <div className="marketing-container">
          <h2 className="type-h2">How it works</h2>
          <div className="marketing-process">
            {feature.steps.map((step, index) => (
              <div key={step.title}>
                <span className="marketing-step-number">0{index + 1}</span>
                <h3 className="type-h3">{step.title}</h3>
                <p className="type-description">{step.description}</p>
              </div>
            ))}
          </div>
          <div className="marketing-availability mt-10">
            <strong>Availability.</strong> {detail.availability}
          </div>
        </div>
      </section>
      <section className="marketing-section marketing-rule">
        <div className="marketing-container">
          <h2 className="type-h2 mb-8">A few useful details</h2>
          <div className="marketing-faq">
            {detail.questions.map((item) => (
              <details key={item.question}>
                <summary>{item.question}</summary>
                <p>{item.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
      {!training && (
        <section className="marketing-section marketing-rule">
          <div className="marketing-container">
            <h2 className="type-h2">See how it all fits together.</h2>
            <p className="type-description mt-4">
              Connect this step to the rest of your content creation workflow.
            </p>
            <div className="marketing-actions">
              {related.map((relatedSlug) => (
                <Link
                  href={`/features/${relatedSlug}`}
                  className="marketing-text-link"
                  key={relatedSlug}
                >
                  {getMarketingFeature(relatedSlug)!.shortTitle}
                </Link>
              ))}
              <Link href="/products/studio" className="marketing-text-link">
                Explore the full Studio workflow
              </Link>
            </div>
          </div>
        </section>
      )}
      {training && <SpeakingGuides />}
      {training ? <TrainingCta /> : <StudioSignup />}
    </MarketingLayout>
  );
}
