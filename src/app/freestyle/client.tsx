"use client";

import Link from "next/link";
import FreestyleHero from "@/components/freestyle-hero";
import PracticeStage from "@/components/practice-stage";
import { FreestyleFaq } from "@/components/freestyle-faq";
import CinematicThemeSwitcher from "@/components/ui/cinematic-theme-switcher";
import { Component as FooterTapedDesign } from "@/components/ui/footer-taped-design";
import { PracticeSessionProvider } from "@/contexts/practice-session";
import type { Topic } from "@/data/topics";

interface FreestyleClientProps {
  initialTopic: Topic;
}

export default function FreestyleClient({
  initialTopic,
}: FreestyleClientProps) {
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
      <header className="border-border flex items-center justify-between border-b px-6 py-3">
        <div className="flex items-center gap-2">
          <Link
            href="/freestyle"
            className="flex items-center gap-2 no-underline"
          >
            <div className="flex h-[28px] w-[28px] items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 to-red-500 text-sm font-black text-white">
              Y
            </div>
            <span className="font-display text-foreground text-[22px] font-semibold tracking-[0.02em]">
              yapper
            </span>
          </Link>
          <span className="ml-1 text-[11px] text-slate-500">ypr.app</span>
        </div>
        <div className="flex items-center gap-1">
          <Link
            href="/"
            className="rounded-full px-3 py-1.5 text-[13px] font-medium text-slate-500 no-underline transition-colors hover:text-slate-300"
          >
            Random Topic
          </Link>
          <span className="rounded-full bg-white/10 px-3 py-1.5 text-[13px] font-medium text-white">
            Freestyle
          </span>
          <div className="ml-2 origin-right scale-[0.5]">
            <CinematicThemeSwitcher />
          </div>
        </div>
      </header>

      <FreestyleHero onJumpToPractice={handleJumpToPractice} />

      <PracticeSessionProvider initialTopic={initialTopic} mode="freestyle">
        <PracticeStage />
      </PracticeSessionProvider>

      <FreestyleFaq />
      <FooterTapedDesign />
    </div>
  );
}
