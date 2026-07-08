import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import TrainingLayout from "@/app/training-layout";
import { Component as Footer } from "@/components/ui/footer-taped-design";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChirpyMark } from "@/components/brand/chirpy-mark";
import StudioNavIcon from "@/components/studio-shell/studio-nav-icon";
import { studioNav } from "@/data/studio-nav";

export const metadata: Metadata = {
  title: "Yapper Studio — from spoken idea to posted video",
  description:
    "Studio is the create-to-post loop for creators: capture ideas by voice, script them with AI, record with a teleprompter, and edit by transcript.",
};

const STEPS = [
  {
    n: "01",
    title: "Capture",
    body: "Hit the plus button and just talk. We sort the idea into the right content pillar and pull in any link you drop.",
  },
  {
    n: "02",
    title: "Script",
    body: "AI shapes the hook options, key points, and a full teleprompter-ready script — edit anything you want.",
  },
  {
    n: "03",
    title: "Record",
    body: "Read your script off the built-in teleprompter and record your take, right in the browser.",
  },
  {
    n: "04",
    title: "Edit & post",
    body: "Cut fillers and mistakes by editing the transcript, export a clean cut, and track it to posted.",
  },
];

export default function StudioMarketingPage() {
  return (
    <TrainingLayout>
      {/* Hero */}
      <section className="relative mx-auto max-w-5xl px-4 pt-16 pb-12 text-center sm:px-6 sm:pt-24">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] opacity-70"
          style={{
            background:
              "radial-gradient(55% 60% at 50% 0%, color-mix(in srgb, var(--sg-accent) 20%, transparent), transparent 70%)",
          }}
        />
        <span className="sg-chip mx-auto">
          <span className="sg-chip-dot" />
          Yapper Studio
        </span>
        <h1 className="sg-display text-foreground mx-auto mt-5 max-w-3xl text-4xl font-black sm:text-5xl">
          From a spoken idea to a posted video, without leaving one place.
        </h1>
        <p className="text-muted-foreground mx-auto mt-5 max-w-xl text-base leading-relaxed sm:text-lg">
          Studio is the whole create-to-post loop for creators. Capture ideas by
          voice, let AI script them, record with a teleprompter, and edit by
          transcript.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="lg" className="sm:px-8">
            <Link href="/studio/library">
              Open Studio
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/studio/inspiration">Browse Inspiration</Link>
          </Button>
        </div>
      </section>

      {/* The four surfaces */}
      <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
        <p className="sg-field-label text-center text-[color:var(--sg-accent)]">
          Everything you need
        </p>
        <h2 className="sg-display text-foreground mt-2 text-center text-2xl font-black sm:text-3xl">
          Four tools, one workflow
        </h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {studioNav.map((item) => (
            <Card
              key={item.href}
              className="gap-0 p-6 transition-colors hover:border-[color:var(--sg-accent)]/40"
            >
              <Link href={item.href} className="no-underline">
                <div className="flex items-start gap-4">
                  <span className="bg-muted text-foreground flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border">
                    <StudioNavIcon icon={item.icon} className="h-5 w-5" />
                  </span>
                  <div>
                    <h3 className="text-foreground text-lg font-black">
                      {item.title}
                    </h3>
                    <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                </div>
              </Link>
            </Card>
          ))}
        </div>
      </section>

      {/* Create-to-post loop */}
      <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
        <p className="sg-field-label text-center text-[color:var(--sg-accent)]">
          How it works
        </p>
        <h2 className="sg-display text-foreground mt-2 text-center text-2xl font-black sm:text-3xl">
          The create-to-post loop
        </h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step) => (
            <Card key={step.n} className="gap-0 p-6">
              <span className="sg-mono text-sm font-black text-[color:var(--sg-accent)]">
                {step.n}
              </span>
              <h3 className="text-foreground mt-3 text-base font-black">
                {step.title}
              </h3>
              <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">
                {step.body}
              </p>
            </Card>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
        <div className="sg-panel flex flex-col items-center gap-5 p-10 text-center">
          <ChirpyMark size={40} />
          <h2 className="sg-display text-foreground max-w-lg text-2xl font-black sm:text-3xl">
            Start turning ideas into videos worth posting.
          </h2>
          <p className="text-muted-foreground max-w-md text-sm sm:text-base">
            Free to start. Your ideas stay yours.
          </p>
          <Button asChild size="lg" className="sm:px-8">
            <Link href="/studio/library">
              Open Studio
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>

      <Footer />
    </TrainingLayout>
  );
}
