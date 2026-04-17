"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { trackModeChanged } from "@/lib/analytics";
import {
  ErrorBoundary,
  PracticeErrorFallback,
} from "@/components/ErrorBoundary";
import HomeHero from "@/components/home-hero";
import FreestyleHero from "@/components/freestyle-hero";
import PracticeStage from "@/components/practice-stage";
import { HomeFaq } from "@/components/home-faq";
import { FreestyleFaq } from "@/components/freestyle-faq";
import Waitlist from "@/components/waitlist";
import { Component as Footer } from "@/components/ui/footer-taped-design";
import CinematicThemeSwitcher from "@/components/ui/cinematic-theme-switcher";
import {
  GlassyModeDropdown,
  type SpeechMode,
} from "@/components/ui/glassy-mode-dropdown";
import { PracticeSessionProvider } from "@/contexts/practice-session";
import type { Topic } from "@/data/topics";

interface LandingClientProps {
  initialTopic: Topic;
}

export default function LandingClient({ initialTopic }: LandingClientProps) {
  const [mode, setMode] = useState<SpeechMode>("random");
  const handleModeChange = useCallback((newMode: SpeechMode) => {
    setMode(newMode);
    trackModeChanged({ mode: newMode });
  }, []);
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
      {/* Header */}
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
        <div className="absolute left-1/2 z-50 -translate-x-1/2">
          <GlassyModeDropdown mode={mode} onChange={handleModeChange} />
        </div>
        <div className="origin-right scale-[0.5]">
          <CinematicThemeSwitcher />
        </div>
      </header>

      {/* Hero (switches based on mode) */}
      {mode === "random" ? (
        <HomeHero onJumpToPractice={handleJumpToPractice} />
      ) : (
        <FreestyleHero onJumpToPractice={handleJumpToPractice} />
      )}

      {/* Practice Stage */}
      <PracticeSessionProvider
        key={mode}
        initialTopic={initialTopic}
        mode={mode === "freestyle" ? "freestyle" : "topic"}
      >
        <ErrorBoundary
          fallback={({ reset }) => <PracticeErrorFallback reset={reset} />}
        >
          <PracticeStage />
        </ErrorBoundary>
      </PracticeSessionProvider>

      {/* What's coming + waitlist form */}
      <Waitlist variant="full" />

      {/* FAQ (switches based on mode) */}
      {mode === "random" ? <HomeFaq /> : <FreestyleFaq />}

      {/* Footer */}
      <Footer />
    </div>
  );
}
