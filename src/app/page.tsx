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
  title: "Yapper: Content Creation App for Social Media Video",
  description:
    "A content creation app for video creators. Capture ideas, generate scripts, record with a teleprompter, edit video by transcript, add captions, schedule, and publish.",
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
              Yapper is coming to mobile and desktop
            </p>
            <h1 className="type-display mt-4">
              Turn every spark into a video worth posting.
            </h1>
            <p className="type-description mt-6 max-w-3xl sm:text-xl">
              Yapper is a content creation app for people who talk to camera.
              Capture ideas, turn them into video scripts, record with a
              teleprompter, edit by transcript, add captions, schedule, and
              publish from one connected studio.
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

      <FeatureDeck />

      <section className="marketing-container pb-20 sm:pb-24">
        <div className="sg-panel grid gap-7 p-8 sm:p-12 md:grid-cols-[auto_1fr_auto] md:items-center">
          <span className="bg-muted flex h-14 w-14 items-center justify-center rounded-2xl border">
            <Download className="h-6 w-6 text-[var(--sg-accent)]" />
          </span>
          <div>
            <h2 className="type-h3">Made for mobile and desktop.</h2>
            <p className="type-description mt-2 text-sm">
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
