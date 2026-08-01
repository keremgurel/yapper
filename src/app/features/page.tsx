import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import TrainingLayout from "@/app/training-layout";
import Waitlist from "@/components/waitlist";
import { Card } from "@/components/ui/card";
import { Component as Footer } from "@/components/ui/footer-taped-design";
import { marketingFeatures } from "@/data/marketing-features";

export const metadata: Metadata = {
  title: "Content Creator Tools From Idea to Published Video",
  description:
    "Explore Yapper's connected content creator tools: idea capture, video scripts, teleprompter recording, transcript video editing, captions, planning, and social publishing.",
  alternates: { canonical: "https://ypr.app/features" },
};

export default function FeaturesPage() {
  return (
    <TrainingLayout>
      <section className="marketing-container relative pt-16 pb-14 text-center sm:pt-24 sm:pb-20">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] opacity-70"
          style={{
            background:
              "radial-gradient(52% 65% at 50% 0%, color-mix(in srgb, var(--sg-accent-2) 19%, transparent), transparent 72%)",
          }}
        />
        <h1 className="type-h1 mx-auto max-w-5xl">
          Everything between “I have an idea” and “it’s live.”
        </h1>
        <p className="type-description mx-auto mt-6 max-w-2xl sm:text-lg">
          Yapper connects the content creator tools that usually live in
          separate apps into one mobile and desktop production flow.
        </p>
      </section>

      <section className="marketing-container pb-24">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {marketingFeatures.map((feature) => (
            <Card
              key={feature.slug}
              className="group gap-0 p-6 transition-all hover:-translate-y-0.5 hover:border-[var(--sg-border-strong)] hover:shadow-md"
            >
              <Link href={`/features/${feature.slug}`} className="no-underline">
                <div
                  className="mb-5 h-1 w-10 rounded-full"
                  style={{ background: feature.accent }}
                />
                <h2 className="type-h3 text-xl">{feature.shortTitle}</h2>
                <p className="type-description mt-2 text-sm">
                  {feature.description}
                </p>
                <span className="text-foreground mt-5 inline-flex items-center gap-2 text-sm font-bold">
                  Learn more
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </span>
              </Link>
            </Card>
          ))}
        </div>
      </section>

      <div id="waitlist">
        <Waitlist variant="full" />
      </div>
      <Footer />
    </TrainingLayout>
  );
}
