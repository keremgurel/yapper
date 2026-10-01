import Link from "next/link";
import MarketingLayout from "@/components/marketing/marketing-layout";
import Breadcrumbs from "@/components/marketing/breadcrumbs";
import { StudioSignup } from "@/components/marketing/product-sections";
import { featureGroups, trainFeatures } from "@/data/marketing-navigation";
import { marketingFeatures } from "@/data/marketing-features";
import { marketingMetadata } from "@/lib/marketing-metadata";

export const metadata = marketingMetadata(
  "Content creation & speaking practice features",
  "Explore idea capture, AI scripts, teleprompter recording, transcript editing, captions, content planning, and social publishing in Yapper Studio. Build speaking confidence with Yapper Train.",
  "/features",
);
export default function FeaturesPage() {
  return (
    <MarketingLayout>
      <section className="marketing-hero">
        <div className="marketing-container">
          <Breadcrumbs
            items={[
              { label: "Products", href: "/products" },
              { label: "Features", href: "/features" },
            ]}
          />
          <h1 className="type-h1 max-w-2xl">
            Create your next video. Practice your next conversation.
          </h1>
          <p className="marketing-lede">
            Yapper Studio takes you from idea to published video. Yapper Train
            helps you build the confidence to say it.
          </p>
          <p className="marketing-note">
            Studio is in private testing.{" "}
            <Link
              href="/products/studio#waitlist"
              className="underline underline-offset-4"
            >
              Join the waitlist
            </Link>
            .
          </p>
          <nav aria-label="Feature categories" className="marketing-actions">
            <Link className="marketing-text-link mr-5" href="#train">
              Yapper Train
            </Link>
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
      <section id="studio" className="marketing-container pb-16">
        <p className="marketing-product-label">Yapper Studio</p>
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
      </section>
      <section id="train" className="marketing-section marketing-rule">
        <div className="marketing-container">
          <p className="marketing-product-label">Yapper Train</p>
          <div className="marketing-feature-group">
            <div>
              <h2 className="type-h2">Speak with more confidence.</h2>
              <p className="type-description mt-4">
                Practice out loud, work on your delivery, and learn what to
                improve. Free practice tools, with optional AI coaching.
              </p>
            </div>
            <div className="marketing-feature-list">
              {trainFeatures.map((feature) => (
                <Link key={feature.href} href={feature.href}>
                  <h3 className="type-h3">{feature.title}</h3>
                  <p className="type-description">{feature.description}</p>
                  <span className="marketing-text-link mt-4">
                    Explore {feature.title.toLowerCase()}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>
      <StudioSignup />
    </MarketingLayout>
  );
}
