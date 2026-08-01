import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Download } from "lucide-react";

import TrainingLayout from "@/app/training-layout";
import HomeJsonLd from "@/app/home-json-ld";
import { BirdMascot } from "@/app/style-guide/mascot/bird-mascot";
import Waitlist from "@/components/waitlist";
import StudioWorkflowTour from "@/components/marketing/studio-workflow-tour";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Component as Footer } from "@/components/ui/footer-taped-design";
import { marketingFeatures } from "@/data/marketing-features";

export const metadata: Metadata = {
  title: "Yapper: The Mobile and Desktop Content Studio for Video Creators",
  description:
    "Capture ideas, develop scripts, record with a teleprompter, edit video by transcript, package each post, and publish from one mobile and desktop creator studio.",
  alternates: { canonical: "https://ypr.app" },
};

export default function HomePage() {
  return (
    <TrainingLayout>
      <HomeJsonLd />

      <section className="mx-auto max-w-[1200px] px-4 pt-16 pb-24 sm:px-6 sm:pt-24 sm:pb-32">
        <div className="flex min-h-[560px] flex-col items-center justify-center text-center">
          <BirdMascot concept="chirpy" talking size={76} />
          <div className="mt-3 flex w-full max-w-5xl flex-col items-center">
            <p className="text-muted-foreground text-sm font-semibold">
              Yapper is coming to mobile and desktop
            </p>
            <h1 className="font-display text-foreground mt-4 text-[clamp(3.25rem,7vw,6.5rem)] leading-[0.9] font-black tracking-[-0.055em]">
              Turn every spark into a video worth posting.
            </h1>
            <p className="text-muted-foreground mt-6 max-w-3xl text-base leading-relaxed sm:text-xl">
              Capture ideas before they disappear. Develop them into scripts,
              record with a teleprompter, edit by transcript, then package,
              schedule, and publish everywhere from one studio.
            </p>
            <div id="waitlist" className="mt-8 w-full max-w-2xl">
              <p className="text-muted-foreground mb-3 text-sm font-medium">
                Be first in line when Yapper is ready to download.
              </p>
              <Waitlist variant="hero" />
            </div>
            <Link
              href="/features"
              className="text-muted-foreground hover:text-foreground relative z-10 mt-6 inline-flex items-center gap-2 text-sm font-semibold no-underline transition-colors"
            >
              Explore everything inside
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <StudioWorkflowTour />

      <section className="mx-auto max-w-[1100px] px-4 py-20 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="font-display text-foreground text-4xl font-black tracking-[-0.04em] sm:text-6xl">
            Everything stays in one creative loop.
          </h2>
          <p className="text-muted-foreground mx-auto mt-5 max-w-2xl leading-relaxed">
            No copying context between five tools. The captured idea stays
            connected to its script, takes, transcript, publishing assets,
            schedule, and performance.
          </p>
        </div>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
                <h3 className="text-foreground text-xl font-black">
                  {feature.shortTitle}
                </h3>
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

      <section className="mx-auto max-w-[1100px] px-4 pb-20 sm:px-6 sm:pb-24">
        <div className="sg-panel grid gap-7 p-8 sm:p-12 md:grid-cols-[auto_1fr_auto] md:items-center">
          <span className="bg-muted flex h-14 w-14 items-center justify-center rounded-2xl border">
            <Download className="h-6 w-6 text-[var(--sg-accent)]" />
          </span>
          <div>
            <h2 className="text-foreground text-2xl font-black sm:text-3xl">
              Made for mobile and desktop.
            </h2>
            <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
              Capture on your phone. Develop, record, edit, schedule, and
              publish from whichever screen fits the moment.
            </p>
          </div>
          <Button asChild>
            <a href="#waitlist">Get early access</a>
          </Button>
        </div>
      </section>

      <Footer />
    </TrainingLayout>
  );
}
