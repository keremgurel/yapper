import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import TrainingLayout from "@/app/training-layout";
import Waitlist from "@/components/waitlist";
import { Card } from "@/components/ui/card";
import { Component as Footer } from "@/components/ui/footer-taped-design";
import { marketingFeatures } from "@/data/marketing-features";

export const metadata: Metadata = {
  title: "Features — One Studio From Idea to Published Video",
  description:
    "Explore Yapper's idea capture, AI script writing, teleprompter, transcript video editor, captions, creator feedback, publishing, and content planning tools.",
  alternates: { canonical: "https://ypr.app/features" },
};

export default function FeaturesPage() {
  return (
    <TrainingLayout>
      <section className="relative mx-auto max-w-5xl px-4 pt-16 pb-14 text-center sm:px-6 sm:pt-24 sm:pb-20">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] opacity-70"
          style={{
            background:
              "radial-gradient(52% 65% at 50% 0%, color-mix(in srgb, var(--sg-accent-2) 19%, transparent), transparent 72%)",
          }}
        />
        <h1 className="font-display text-foreground mx-auto max-w-4xl text-5xl leading-[0.98] font-black tracking-[-0.05em] sm:text-7xl">
          Everything between “I have an idea” and “it’s live.”
        </h1>
        <p className="text-muted-foreground mx-auto mt-6 max-w-2xl text-base leading-relaxed sm:text-lg">
          Yapper connects the scattered pieces of creator work into one desktop
          production flow.
        </p>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
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
                <h2 className="text-foreground text-xl font-black">
                  {feature.shortTitle}
                </h2>
                <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
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
