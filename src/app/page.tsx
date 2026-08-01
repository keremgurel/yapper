import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Download } from "lucide-react";

import TrainingLayout from "@/app/training-layout";
import HomeJsonLd from "@/app/home-json-ld";
import { Aurora } from "@/app/style-guide/aurora/aurora-bg";
import { BirdMascot } from "@/app/style-guide/mascot/bird-mascot";
import Waitlist from "@/components/waitlist";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Component as Footer } from "@/components/ui/footer-taped-design";
import { marketingFeatures } from "@/data/marketing-features";

export const metadata: Metadata = {
  title: "Yapper — The Desktop Content Studio for Video Creators",
  description:
    "Capture ideas, write scripts, record with a teleprompter, edit video by transcript, add captions, and publish—all in one desktop creator studio.",
  alternates: { canonical: "https://ypr.app" },
};

export default function HomePage() {
  return (
    <TrainingLayout>
      <HomeJsonLd />

      <section className="mx-auto max-w-[1200px] px-4 pt-5 pb-16 sm:px-6 sm:pt-8 sm:pb-24">
        <div className="relative overflow-hidden rounded-[var(--sg-radius-2xl)] border border-[var(--sg-border)]">
          <Aurora palette="teal" />
          <div className="sg-glass relative m-4 flex min-h-[590px] flex-col items-center justify-center rounded-[var(--sg-radius-2xl)] px-6 py-9 text-center sm:m-5 sm:px-12 sm:py-10">
            <div className="relative">
              <div className="absolute inset-0 scale-125 rounded-full bg-black/20 blur-3xl" />
              <BirdMascot concept="chirpy" talking size={76} />
            </div>
            <div className="mt-1 flex w-full max-w-4xl flex-col items-center">
              <p className="text-sm font-semibold text-white/70">
                Yapper Studio is coming to desktop
              </p>
              <h1 className="font-display mt-4 text-[clamp(3rem,7vw,6.5rem)] leading-[0.9] font-black tracking-[-0.055em] text-white">
                From idea to posted video.
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-relaxed text-white/80 sm:text-xl">
                Capture the thought, shape the script, record the take, edit the
                words, and publish—all in one focused creator studio.
              </p>
              <div id="waitlist" className="mt-6 w-full max-w-2xl">
                <p className="mb-3 text-sm font-medium text-white/70">
                  Be first in line when the desktop download is ready.
                </p>
                <Waitlist variant="hero" />
              </div>
              <Link
                href="/features"
                className="relative z-10 mt-5 inline-flex items-center gap-2 text-sm font-semibold text-white/70 no-underline transition-colors hover:text-white"
              >
                Explore everything inside
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1100px] px-4 py-20 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="font-display text-foreground text-4xl font-black tracking-[-0.04em] sm:text-6xl">
            The whole create-to-post workflow.
          </h2>
          <p className="text-muted-foreground mx-auto mt-5 max-w-2xl leading-relaxed">
            Every part of Yapper shares the same project. Your original idea
            stays connected to the script, recording, edit, and final post.
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
              A real desktop app, built for focused work.
            </h2>
            <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
              Local media handling and the entire workflow under one roof—no tab
              pile required.
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
