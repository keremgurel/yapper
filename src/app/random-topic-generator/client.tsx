"use client";

import Link from "next/link";
import {
  ErrorBoundary,
  PracticeErrorFallback,
} from "@/components/ErrorBoundary";
import HomeHero from "@/components/home-hero";
import PracticeStage from "@/components/practice-stage";
import { HomeFaq } from "@/components/home-faq";
import CinematicThemeSwitcher from "@/components/ui/cinematic-theme-switcher";
import { Component as FooterTapedDesign } from "@/components/ui/footer-taped-design";
import { PracticeSessionProvider } from "@/contexts/practice-session";
import type { Topic } from "@/data/topics";

interface RandomTopicClientProps {
  initialTopic: Topic;
}

export default function RandomTopicClient({
  initialTopic,
}: RandomTopicClientProps) {
  const handleJumpToPractice = () => {
    const practiceElement = document.getElementById("practice");
    if (!practiceElement) return;

    const rect = practiceElement.getBoundingClientRect();
    const elementCenter = window.scrollY + rect.top + rect.height / 2;
    window.scrollTo({
      top: elementCenter - window.innerHeight / 2,
      behavior: "smooth",
    });
  };

  return (
    <div className="flex min-h-screen flex-col transition-colors duration-300">
      <header className="border-border flex items-center justify-between border-b px-3 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-2">
          <Link href="/" className="flex items-center gap-2 no-underline">
            <div className="flex h-[28px] w-[28px] shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 to-red-500 text-sm font-black text-white">
              Y
            </div>
            <span className="font-display text-foreground hidden text-[22px] font-semibold tracking-[0.02em] sm:inline">
              yapper
            </span>
          </Link>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <span className="rounded-full bg-white/10 px-2 py-1.5 text-[13px] font-medium text-white sm:px-3">
            Random Topic
          </span>
          <Link
            href="/freestyle-speech"
            className="rounded-full px-2 py-1.5 text-[13px] font-medium text-slate-500 no-underline transition-colors hover:text-slate-300 sm:px-3"
          >
            Freestyle
          </Link>
          <div className="ml-1 origin-right scale-[0.5] sm:ml-2">
            <CinematicThemeSwitcher />
          </div>
        </div>
      </header>

      <HomeHero onJumpToPractice={handleJumpToPractice} />

      <PracticeSessionProvider initialTopic={initialTopic}>
        <ErrorBoundary
          fallback={({ reset }) => <PracticeErrorFallback reset={reset} />}
        >
          <PracticeStage />
        </ErrorBoundary>
      </PracticeSessionProvider>

      <HomeFaq />
      <FooterTapedDesign />
    </div>
  );
}
