import Link from "next/link";
import MarketingLayout from "@/components/marketing/marketing-layout";
import Breadcrumbs from "@/components/marketing/breadcrumbs";
import { ArrowUpRight } from "lucide-react";
import { StudioStart } from "@/components/marketing/product-sections";
import { featurePalettes } from "@/components/marketing/feature-preview";
import { featureGroups } from "@/data/marketing-navigation";
import { marketingFeatures } from "@/data/marketing-features";
import { marketingMetadata } from "@/lib/marketing-metadata";

export const metadata = marketingMetadata(
  "Yapper Studio features for scripted video",
  "Everything in Yapper Studio: idea capture, AI script writing, teleprompter recording, transcript video editing, captions, a content calendar and social publishing.",
  "/features",
);

export default function FeaturesPage() {
  return (
    <MarketingLayout>
      <section className="marketing-hero">
        <div className="marketing-container">
          <Breadcrumbs
            items={[
              { label: "Yapper Studio", href: "/" },
              { label: "Features", href: "/features" },
            ]}
          />
          <h1 className="type-h1 max-w-2xl">Yapper Studio features</h1>
          <p className="marketing-lede">
            Studio covers a video from the first note to the published post.
            Each feature below has its own page with a working example.
          </p>
          <p className="marketing-note">
            Try every feature free for 7 days.
            <Link href="/pricing" className="underline underline-offset-4">
              See plans
            </Link>
            .
          </p>
          <nav aria-label="Feature categories" className="marketing-actions">
            {featureGroups.map((group) => (
              <Link
                key={group.id}
                className="marketing-text-link mr-5"
                href={`#${group.id}`}
              >
                {group.title}
              </Link>
            ))}
          </nav>
        </div>
      </section>
      <div className="marketing-container pb-16">
        {featureGroups.map((group) => (
          <section
            key={group.id}
            id={group.id}
            className="marketing-feature-group"
          >
            <div>
              <h2 className="type-h2">{group.title}</h2>
              <p className="type-description mt-4">{group.description}</p>
            </div>
            <div className="marketing-feature-list">
              {group.slugs.map((slug) => {
                const feature = marketingFeatures.find((f) => f.slug === slug)!;
                return (
                  <Link
                    key={slug}
                    href={`/features/${slug}`}
                    className="reveal-card"
                    data-palette={featurePalettes[slug]}
                  >
                    <span className="reveal-card-tag">{group.title}</span>
                    <span className="reveal-card-arrow" aria-hidden="true">
                      <ArrowUpRight size={18} strokeWidth={1.75} />
                    </span>
                    <h3 className="reveal-card-title">{feature.shortTitle}</h3>
                    <p className="reveal-card-copy">{feature.description}</p>
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
      </div>
      <StudioStart />
    </MarketingLayout>
  );
}
