import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Download } from "lucide-react";

import TrainingLayout from "@/app/training-layout";
import HomeJsonLd from "@/app/home-json-ld";
import { BirdMascot } from "@/app/style-guide/mascot/bird-mascot";
import Waitlist from "@/components/waitlist";
import ActSection from "@/components/marketing/act-section";
import ClosingCta from "@/components/marketing/closing-cta";
import ProofStrip from "@/components/marketing/proof-strip";
import Reveal from "@/components/marketing/reveal";
import ScrollShowcase from "@/components/marketing/scroll-showcase";
import {
  CorrectionsMock,
  PolishedMock,
  PromptMock,
  ScoreMock,
} from "@/components/marketing/training-mocks";
import { HomeFaq } from "@/components/home-faq";
import { getJsonLdFaqEntries } from "@/data/faq";
import { safeJsonLdStringify } from "@/lib/json-ld";
import StudioLoopStrip from "@/components/marketing/studio-loop-strip";
import { Button } from "@/components/ui/button";
import { Component as Footer } from "@/components/ui/footer-taped-design";

export const metadata: Metadata = {
  title: "Yapper: Content Creation App for Social Media Video",
  description:
    "A content creation app for video creators. Capture ideas, generate scripts, record with a teleprompter, edit video by transcript, add captions, schedule, and publish. Plus free speaking practice tools with AI coaching.",
  alternates: { canonical: "https://ypr.app" },
};

/** The four beats of a coached rep, each paired with the screen that shows it.
 * Ordered the way it actually happens, so the column reads as one pass through
 * the product rather than a feature list. */
const TRAINING_SHOWCASE = [
  {
    id: "prompt",
    eyebrow: "Speak",
    title: "A prompt, a timer, and nothing else in the way",
    body: "Pull a topic or bring your own, set the clock, and talk. No account, no setup, no limit on how many times you go again.",
    media: <PromptMock />,
  },
  {
    id: "score",
    eyebrow: "Score",
    title: "Find out how it actually landed",
    body: "Five dimensions, each with the reasoning behind the number and a quote from your own answer. Pace, pauses and filler habits are measured from the recording, not guessed at.",
    media: <ScoreMock />,
  },
  {
    id: "fix",
    eyebrow: "Fix",
    title: "Every slip named, in your own words",
    body: "Grammar, word choice and phrasing marked in the transcript where they happened, each with the rule behind the correction so it sticks.",
    media: <CorrectionsMock />,
  },
  {
    id: "polish",
    eyebrow: "Keep",
    title: "The version you were reaching for",
    body: "Your answer rewritten in clean, natural English, built from your ideas and your structure. Not a better answer. The same one, said properly.",
    media: <PolishedMock />,
  },
];

export default function HomePage() {
  return (
    <TrainingLayout>
      <HomeJsonLd />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: safeJsonLdStringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: getJsonLdFaqEntries().map((entry) => ({
              "@type": "Question",
              name: entry.name,
              acceptedAnswer: { "@type": "Answer", text: entry.text },
            })),
          }),
        }}
      />

      <section className="marketing-container pt-16 pb-24 sm:pt-24 sm:pb-32">
        <div className="flex min-h-[560px] flex-col items-center justify-center text-center">
          <BirdMascot concept="chirpy" talking size={76} />
          <div className="mt-3 flex w-full max-w-5xl flex-col items-center">
            <p className="text-muted-foreground text-sm font-semibold">
              Yapper is coming to mobile and desktop
            </p>
            <h1 className="type-display mt-4">
              Get better on camera. Turn every spark into a video worth posting.
            </h1>
            <p className="type-description mt-6 max-w-3xl sm:text-xl">
              Yapper is a content creation app for people who talk to camera.
              Capture ideas, turn them into video scripts, record with a
              teleprompter, edit by transcript, add captions, schedule, and
              publish from one connected studio.
            </p>

            {/* Two doors, nothing else. Studio is the product we are building,
                so it takes the one accent-filled action; training is the half
                someone can use today. The waitlist lives further down, where it
                catches people who read the case first. */}
            <div className="mt-9 flex flex-col items-center gap-3 sm:flex-row">
              <Button asChild size="lg" className="sm:px-8">
                <Link href="/studio" className="no-underline">
                  Explore Studio
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="sm:px-8">
                <Link href="/training" className="no-underline">
                  Begin training
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <Reveal className="marketing-container pb-4">
        <ProofStrip />
      </Reveal>

      <ActSection
        index="01"
        eyebrow="Free to use today"
        title="Get better at speaking"
        description="Pull a prompt, start the timer, and talk. No account needed. When you want to know how it actually landed, AI coaching scores the answer, corrects the grammar and word choices you slipped on, and writes back the version you were reaching for."
        action={
          <Button asChild size="lg" className="sm:px-8">
            <Link href="/training" className="no-underline">
              Begin training
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        }
      >
        <ScrollShowcase items={TRAINING_SHOWCASE} />
      </ActSection>

      <ActSection
        index="02"
        eyebrow="In the works"
        title="Then post without the friction"
        description="Studio is the other half: capture an idea by voice, let AI script it, record off the teleprompter, cut the take by editing its transcript, and send it out. One connected path instead of six disconnected apps."
        action={
          <Button asChild size="lg" variant="outline" className="sm:px-8">
            <Link href="/studio" className="no-underline">
              Explore Studio
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        }
      >
        <StudioLoopStrip />
      </ActSection>

      {/* The waitlist, kept below the case rather than in front of it. */}
      <section id="waitlist" className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
        <div className="sg-panel flex flex-col items-center gap-5 p-10 text-center">
          <span className="bg-muted flex h-14 w-14 items-center justify-center rounded-2xl border">
            <Download className="h-6 w-6 text-[var(--sg-accent)]" />
          </span>
          <h2 className="sg-display text-foreground max-w-lg text-2xl font-black sm:text-3xl">
            Made for mobile and desktop
          </h2>
          <p className="text-muted-foreground max-w-md text-sm sm:text-base">
            Capture on your phone. Develop, record, edit, schedule, and publish
            from whichever screen fits the moment. We will email you the moment
            it is ready to download.
          </p>
          <div className="w-full max-w-xl">
            <Waitlist variant="hero" />
          </div>
        </div>
      </section>

      <Reveal>
        <HomeFaq />
      </Reveal>

      <Reveal>
        <ClosingCta />
      </Reveal>

      <Footer />
    </TrainingLayout>
  );
}
