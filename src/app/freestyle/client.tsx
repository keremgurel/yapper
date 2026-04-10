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
          <div className="ml-2 flex items-center gap-2">
            <a
              href="https://www.tiktok.com/@ypr.app"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="TikTok"
              className="text-slate-500 transition-colors hover:text-slate-300"
            >
              <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
                <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.27 6.27 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.34-6.34V8.75a8.18 8.18 0 0 0 4.76 1.52V6.84a4.84 4.84 0 0 1-1-.15Z" />
              </svg>
            </a>
            <a
              href="https://www.instagram.com/ypr.app/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram"
              className="text-slate-500 transition-colors hover:text-slate-300"
            >
              <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069ZM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0Zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324ZM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8Zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881Z" />
              </svg>
            </a>
            <a
              href="https://x.com/openclawfred"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="X"
              className="text-slate-500 transition-colors hover:text-slate-300"
            >
              <svg className="h-3.5 w-3.5 fill-current" viewBox="0 0 24 24">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </a>
          </div>
          <div className="ml-1 origin-right scale-[0.5]">
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
