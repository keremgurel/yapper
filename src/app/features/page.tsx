import Link from "next/link";
import MarketingLayout from "@/components/marketing/marketing-layout";
import Breadcrumbs from "@/components/marketing/breadcrumbs";
import { StudioStart } from "@/components/marketing/product-sections";
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
                  <Link key={slug} href={`/features/${slug}`}>
                    <h3 className="type-h3">{feature.shortTitle}</h3>
                    <p className="type-description">{feature.description}</p>
                    <span className="marketing-text-link mt-4">
                      Explore {feature.shortTitle.toLowerCase()}
                    </span>
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
