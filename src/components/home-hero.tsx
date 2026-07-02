"use client";

import Link from "next/link";
import { Show, SignInButton } from "@clerk/nextjs";
import { GlassyButton } from "@/components/ui/glassy-button";

interface HomeHeroProps {
  onJumpToPractice: () => void;
}

export default function HomeHero({ onJumpToPractice }: HomeHeroProps) {
  return (
    <div className="px-6 pt-10 pb-16 text-center md:pt-14 md:pb-24">
      <div className="mb-5 flex justify-center">
        <div className="hero-badge-prominent inline-flex items-center gap-3 rounded-full px-4 py-2.5 backdrop-blur-md">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-red-500 text-[13px] font-semibold text-white shadow-[0_0_18px_rgba(249,115,22,0.45)]">
            Y
          </span>
          <span className="font-display text-[18px] font-semibold tracking-[0.01em]">
            The create-to-post studio for people who talk to camera.
          </span>
        </div>
      </div>

      <h1 className="font-display text-foreground mx-auto mb-4 max-w-4xl text-[40px] leading-[0.98] font-semibold tracking-[-0.03em] md:text-[72px] md:leading-[0.88]">
        Get better on camera.
        <br />
        Post consistently.
      </h1>

      <p className="hero-description mx-auto mb-8 max-w-2xl text-[16px] leading-relaxed md:text-[19px]">
        Yapper takes you from idea to posted: generate a script, read it off the
        teleprompter, fix mistakes by editing the transcript, and get AI
        coaching before you publish. Free practice tools included, no sign-up.
      </p>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Show when="signed-out">
          <SignInButton mode="modal" withSignUp>
            <button
              type="button"
              className="rounded-full bg-cyan-500 px-6 text-[15px] font-bold text-white shadow-sm transition-colors hover:bg-cyan-600"
              style={{ height: 48 }}
            >
              Get started free
            </button>
          </SignInButton>
        </Show>
        <Show when="signed-in">
          <Link
            href="/create"
            className="inline-flex items-center rounded-full bg-cyan-500 px-6 text-[15px] font-bold text-white no-underline shadow-sm transition-colors hover:bg-cyan-600"
            style={{ height: 48 }}
          >
            Open your studio
          </Link>
        </Show>

        <GlassyButton onClick={onJumpToPractice} height={48}>
          Train
        </GlassyButton>
      </div>
    </div>
  );
}
