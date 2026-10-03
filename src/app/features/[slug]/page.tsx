import Link from "next/link";
import { notFound } from "next/navigation";
import { Check } from "lucide-react";
import MarketingLayout from "@/components/marketing/marketing-layout";
import Breadcrumbs from "@/components/marketing/breadcrumbs";
import FeaturePreview from "@/components/marketing/feature-preview";
import StudioCtaButton from "@/components/marketing/studio-cta-button";
import { StudioStart } from "@/components/marketing/product-sections";
import {
  getMarketingFeature,
  marketingFeatures,
} from "@/data/marketing-features";
import { featureDetails } from "@/data/feature-details";
import { relatedFeatures } from "@/data/marketing-resources";
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
              "@id": `${SITE_URL}/products/studio#software`,
              name: "Yapper Studio",
              url: `${SITE_URL}/products/studio`,
            },
          }),
        }}
      />
      <section className="marketing-hero">
        <div className="marketing-container">
          <Breadcrumbs
            items={[
              { label: "Yapper Studio", href: "/products/studio" },
              { label: "Features", href: "/features" },
              { label: feature.shortTitle, href: `/features/${slug}` },
            ]}
          />
          <div className="marketing-feature-hero">
            <div>
              <h1 className="type-h1">{feature.title}</h1>
              <p className="marketing-lede">{feature.description}</p>
              <div className="marketing-actions">
                <StudioCtaButton />
              </div>
              <p className="marketing-note">7 days free. Cancel anytime.</p>
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
            <Link
              href="/products/studio/pricing"
              className="marketing-text-link"
            >
              Studio pricing
            </Link>
          </div>
        </div>
      </section>
      <StudioStart />
    </MarketingLayout>
  );
}
