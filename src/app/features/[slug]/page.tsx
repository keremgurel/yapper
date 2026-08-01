import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";

import TrainingLayout from "@/app/training-layout";
import Waitlist from "@/components/waitlist";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Component as Footer } from "@/components/ui/footer-taped-design";
import {
  getMarketingFeature,
  marketingFeatures,
} from "@/data/marketing-features";
import { getSiteUrl, safeJsonLdStringify } from "@/lib/json-ld";

export function generateStaticParams() {
  return marketingFeatures.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const feature = getMarketingFeature(slug);
  if (!feature) return {};
  return {
    title: feature.seoTitle,
    description: feature.seoDescription,
    alternates: { canonical: `${getSiteUrl()}/features/${feature.slug}` },
    openGraph: {
      title: feature.seoTitle,
      description: feature.seoDescription,
      type: "website",
    },
  };
}

export default async function FeatureDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const feature = getMarketingFeature(slug);
  if (!feature) notFound();
  const currentIndex = marketingFeatures.findIndex(
    (item) => item.slug === slug,
  );
  const nextFeature =
    marketingFeatures[(currentIndex + 1) % marketingFeatures.length];
  const site = getSiteUrl();
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: `Yapper ${feature.shortTitle}`,
    applicationCategory: "MultimediaApplication",
    operatingSystem: "macOS, Windows",
    url: `${site}/features/${feature.slug}`,
    description: feature.seoDescription,
    isPartOf: {
      "@type": "SoftwareApplication",
      name: "Yapper Studio",
      url: site,
    },
  };

  return (
    <TrainingLayout>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(jsonLd) }}
      />

      <section className="relative mx-auto max-w-5xl px-4 pt-10 pb-16 sm:px-6 sm:pt-14 sm:pb-24">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[500px] opacity-60"
          style={{
            background: `radial-gradient(48% 62% at 50% 0%, color-mix(in srgb, ${feature.accent} 20%, transparent), transparent 74%)`,
          }}
        />
        <Link
          href="/features"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-2 text-sm font-semibold no-underline"
        >
          <ArrowLeft className="h-4 w-4" />
          All features
        </Link>
        <div className="mt-16 max-w-4xl">
          <div
            className="mb-7 h-1.5 w-14 rounded-full"
            style={{ background: feature.accent }}
          />
          <h1 className="font-display text-foreground text-5xl leading-[0.98] font-black tracking-[-0.05em] sm:text-7xl">
            {feature.title}
          </h1>
          <p className="text-muted-foreground mt-7 max-w-2xl text-base leading-relaxed sm:text-xl">
            {feature.description}
          </p>
          <Button asChild size="lg" className="mt-8">
            <a href="#waitlist">
              Join the waitlist
              <ArrowRight className="h-4 w-4" />
            </a>
          </Button>
        </div>
      </section>

      <section className="border-y bg-[var(--sg-surface-sunken)]">
        <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6 sm:py-20">
          <p className="font-display text-foreground max-w-4xl text-3xl leading-tight font-semibold tracking-[-0.035em] sm:text-5xl">
            {feature.promise}
          </p>
        </div>
      </section>

      <section className="mx-auto grid max-w-5xl gap-12 px-4 py-20 sm:px-6 sm:py-24 md:grid-cols-[0.8fr_1.2fr]">
        <h2 className="font-display text-foreground text-3xl font-black tracking-[-0.035em] sm:text-4xl">
          Built for momentum, not busywork.
        </h2>
        <ul className="m-0 list-none p-0">
          {feature.highlights.map((highlight) => (
            <li
              key={highlight}
              className="text-foreground flex items-center gap-3 border-b py-5 text-sm font-semibold sm:text-base"
            >
              <Check
                className="h-4 w-4 shrink-0"
                style={{ color: feature.accent }}
              />
              {highlight}
            </li>
          ))}
        </ul>
      </section>

      <section className="bg-[var(--sg-surface-sunken)] py-20 sm:py-24">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <h2 className="font-display text-foreground text-3xl font-black tracking-[-0.035em] sm:text-4xl">
            How it fits into your workflow
          </h2>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {feature.steps.map((step) => (
              <Card key={step.title} className="gap-0 p-6">
                <h3 className="text-foreground text-lg font-black">
                  {step.title}
                </h3>
                <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                  {step.description}
                </p>
              </Card>
            ))}
          </div>
          <Link
            href={`/features/${nextFeature.slug}`}
            className="text-foreground mt-12 inline-flex items-center gap-2 text-sm font-black no-underline"
          >
            Next: {nextFeature.shortTitle}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <div id="waitlist">
        <Waitlist variant="full" />
      </div>
      <Footer />
    </TrainingLayout>
  );
}
