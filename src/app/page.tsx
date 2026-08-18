import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Download } from "lucide-react";

import TrainingLayout from "@/app/training-layout";
import HomeJsonLd from "@/app/home-json-ld";
import { BirdMascot } from "@/app/style-guide/mascot/bird-mascot";
import Waitlist from "@/components/waitlist";
import StudioWorkflowTour from "@/components/marketing/studio-workflow-tour";
import FeatureDeck from "@/components/marketing/feature-deck";
import { Button } from "@/components/ui/button";
import { Component as Footer } from "@/components/ui/footer-taped-design";

export const metadata: Metadata = {
  title: "Yapper: Speaking Practice with AI Coaching",
  description:
    "Free speaking practice tools with a timer and prompts. Record an answer and get it scored, your grammar and word choices corrected, and a clean version of what you said.",
  alternates: { canonical: "https://ypr.app" },
};

export default function HomePage() {
  return (
    <TrainingLayout>
      <HomeJsonLd />

      <section className="marketing-container pt-16 pb-24 sm:pt-24 sm:pb-32">
        <div className="flex min-h-[560px] flex-col items-center justify-center text-center">
          <BirdMascot concept="chirpy" talking size={76} />
          <div className="mt-3 flex w-full max-w-5xl flex-col items-center">
            <p className="text-muted-foreground text-sm font-semibold">
              The practice tools are free. The coaching is the paid part.
            </p>
            <h1 className="type-display mt-4">
              Speak for a minute. Find out exactly what to fix.
            </h1>
            <p className="type-description mt-6 max-w-3xl sm:text-xl">
              Pull a prompt, start the timer, and talk. Your coach scores the
              answer, corrects the grammar and word choices you slipped on, and
              writes back the version you were reaching for.
            </p>
            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link
                  href="/training/random-topic-generator"
                  className="no-underline"
                >
                  Start practicing
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/pricing" className="no-underline">
                  See what coaching costs
                </Link>
              </Button>
            </div>
            <Link
              href="/training"
              className="text-muted-foreground hover:text-foreground relative z-10 mt-6 inline-flex items-center gap-2 text-sm font-semibold no-underline transition-colors"
            >
              Browse all the practice tools
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <StudioWorkflowTour />

      <FeatureDeck />

      {/* The full studio app is genuinely unreleased, so the waitlist stays.
          It just no longer stands in front of the product that is live. */}
      <section id="waitlist" className="marketing-container pb-20 sm:pb-24">
        <div className="sg-panel grid gap-7 p-8 sm:p-12 md:grid-cols-[auto_1fr] md:items-center">
          <span className="bg-muted flex h-14 w-14 items-center justify-center rounded-2xl border">
            <Download className="h-6 w-6 text-[var(--sg-accent)]" />
          </span>
          <div>
            <h2 className="type-h3">The full studio is still being built.</h2>
            <p className="type-description mt-2 max-w-[60ch] text-sm">
              Scripts, a teleprompter recorder, and transcript-based editing for
              Mac and mobile. Leave your email and we will tell you when it is
              ready to download.
            </p>
            <div className="mt-5 max-w-xl">
              <Waitlist variant="hero" />
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </TrainingLayout>
  );
}
