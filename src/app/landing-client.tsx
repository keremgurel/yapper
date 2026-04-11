"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { MeshGradient } from "@paper-design/shaders-react";
import {
  ErrorBoundary,
  PracticeErrorFallback,
} from "@/components/ErrorBoundary";
import HomeHero from "@/components/home-hero";
import FreestyleHero from "@/components/freestyle-hero";
import PracticeStage from "@/components/practice-stage";
import { HomeFaq } from "@/components/home-faq";
import { FreestyleFaq } from "@/components/freestyle-faq";
import CinematicThemeSwitcher from "@/components/ui/cinematic-theme-switcher";
import { Component as FooterTapedDesign } from "@/components/ui/footer-taped-design";
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
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    // TODO: wire up to email collection backend
    setSubmitted(true);
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
          <GlassyModeDropdown mode={mode} onChange={setMode} />
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

      {/* FAQ (switches based on mode) */}
      {mode === "random" ? <HomeFaq /> : <FreestyleFaq />}

      {/* Waitlist section */}
      <section className="px-4 py-16 sm:px-6 sm:py-24">
        <div className="shadow-container relative mx-auto max-w-3xl overflow-hidden rounded-3xl border border-slate-200/90 dark:border-white/8">
          <div className="absolute inset-0">
            <MeshGradient
              className="absolute inset-0 h-full w-full"
              colors={["#000000", "#06b6d4", "#0891b2", "#164e63", "#f97316"]}
              speed={0.3}
              distortion={0.4}
              swirl={0.3}
            />
          </div>

          <div className="relative flex flex-col items-center px-6 py-16 text-center sm:px-12 sm:py-20">
            <h2 className="font-display mb-3 text-[28px] leading-[1.15] font-semibold tracking-[-0.02em] text-white sm:text-[36px]">
              AI coaching, coming soon.
            </h2>
            <p className="mb-8 max-w-sm text-[15px] leading-[1.6] text-white/60 sm:text-[16px]">
              Be first to try AI-powered speech coaching when we launch. Early
              access for waitlist members.
            </p>

            {!submitted ? (
              <form
                onSubmit={handleSubmit}
                className="flex w-full max-w-md flex-col gap-3 sm:flex-row"
              >
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Your email address"
                  required
                  className="flex-1 rounded-lg border border-white/15 bg-white/10 px-4 py-3 text-[15px] text-white backdrop-blur-sm transition-colors outline-none placeholder:text-white/40 focus:border-white/30 focus:bg-white/15"
                />
                <button
                  type="submit"
                  className="inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-lg border border-white/20 bg-white px-6 py-3 text-[14px] font-semibold text-slate-900 transition-colors hover:bg-white/90"
                >
                  Get Notified
                  <ArrowRight className="h-4 w-4" />
                </button>
              </form>
            ) : (
              <div className="animate-fade-slide-in rounded-lg border border-emerald-400/30 bg-emerald-500/15 px-6 py-4 text-[15px] font-medium text-emerald-300 backdrop-blur-sm">
                You&apos;re on the list. We&apos;ll be in touch.
              </div>
            )}
          </div>
        </div>
      </section>

      <FooterTapedDesign />
    </div>
  );
}
