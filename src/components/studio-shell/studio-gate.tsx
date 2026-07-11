"use client";

import { usePathname } from "next/navigation";
import { SignInButton } from "@clerk/nextjs";
import { Check, Lock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ChirpyMark } from "@/components/brand/chirpy-mark";

interface GateCopy {
  eyebrow: string;
  headline: string;
  sub: string;
  perks: string[];
}

/** The sell for each locked surface. Keep it concrete: what this specific tool
 * does for the creator, not a generic "please sign in". */
const COPY: Record<string, GateCopy> = {
  "/studio/library": {
    eyebrow: "Content Library",
    headline: "Your whole content pipeline, from idea to posted.",
    sub: "Capture an idea by voice, let AI shape the hooks, key points, and a full script, then track every video from drafted to posted.",
    perks: [
      "Speak an idea — we sort it into the right content pillar",
      "AI writes hooks, key points, and a teleprompter-ready script",
      "Track drafted → planned → scheduled → posted in one board",
    ],
  },
  "/studio/inspiration": {
    eyebrow: "Inspiration",
    headline: "A swipe file of the creators and clips you learn from.",
    sub: "Drop a YouTube, TikTok, or Instagram link. We grab the title, thumbnail, and transcript, then turn any clip into your own video idea.",
    perks: [
      "Save clips and creators, organized by content pillar",
      "Auto-transcribe so you can study what actually worked",
      "Turn any inspiration into a fresh idea in one click",
    ],
  },
  "/studio/recorder": {
    eyebrow: "Recorder",
    headline: "Record your take with the script on a teleprompter.",
    sub: "Read your script off the screen while you record, so every take lands clean and on-message.",
    perks: [
      "Built-in teleprompter scrolls at your pace",
      "Record straight from your script, no app-switching",
      "Takes save to your library, ready to edit",
    ],
  },
  "/studio/editor": {
    eyebrow: "Editor",
    headline: "Edit your video by editing the transcript.",
    sub: "Cut filler words, awkward pauses, and whole sentences just by deleting text. No timeline scrubbing.",
    perks: [
      "Delete words to cut the video — it's that direct",
      "Strip filler and silences automatically",
      "Export a clean cut ready to post",
    ],
  },
};

const FALLBACK_COPY: GateCopy = {
  eyebrow: "Yapper Studio",
  headline: "Your studio for making videos worth posting.",
  sub: "Ideas, scripts, recording, and editing — the whole create-to-post loop in one place.",
  perks: [
    "Turn a spoken idea into a finished script",
    "Record with a teleprompter, edit by transcript",
    "Track everything from drafted to posted",
  ],
};

function copyFor(pathname: string): GateCopy {
  const key = Object.keys(COPY).find((k) => pathname.startsWith(k));
  return key ? COPY[key] : FALLBACK_COPY;
}

/** Shown in place of a locked Studio surface when the visitor is signed out.
 * The shell (sidebar + header) stays visible, so this reads as "here's what
 * you unlock", not a dead end. */
export default function StudioGate() {
  const pathname = usePathname();
  const { eyebrow, headline, sub, perks } = copyFor(pathname);

  return (
    <div className="relative flex min-h-[calc(100svh-8rem)] items-center justify-center px-2 py-10">
      {/* soft brand glow behind the card */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-70"
        style={{
          background:
            "radial-gradient(60% 55% at 50% 30%, color-mix(in srgb, var(--sg-accent) 18%, transparent), transparent 70%)",
        }}
      />
      <div className="sg-panel mx-auto w-full max-w-xl p-8 text-center sm:p-10">
        <div className="bg-muted text-foreground/80 mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl border">
          <Lock className="h-5 w-5" />
        </div>

        <p className="sg-field-label mb-3 text-[color:var(--sg-accent)]">
          {eyebrow}
        </p>
        <h1 className="font-display text-foreground text-2xl font-black tracking-tight sm:text-3xl">
          {headline}
        </h1>
        <p className="text-muted-foreground mx-auto mt-3 max-w-md text-sm leading-relaxed sm:text-base">
          {sub}
        </p>

        <ul className="mx-auto mt-6 flex max-w-sm flex-col gap-2.5 text-left">
          {perks.map((perk) => (
            <li key={perk} className="flex items-start gap-2.5">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[color:var(--sg-accent)]/15 text-[color:var(--sg-accent)]">
                <Check className="h-3.5 w-3.5" />
              </span>
              <span className="text-foreground/85 text-sm">{perk}</span>
            </li>
          ))}
        </ul>

        <div className="mt-8 flex flex-col items-center gap-3">
          <SignInButton mode="modal" withSignUp>
            <Button size="lg" className="w-full max-w-xs sm:w-auto sm:px-8">
              Start free — no card needed
            </Button>
          </SignInButton>
          <SignInButton mode="modal">
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground text-sm font-semibold"
            >
              I already have an account
            </button>
          </SignInButton>
        </div>

        <div className="text-muted-foreground/70 mt-8 flex items-center justify-center gap-2 text-xs">
          <ChirpyMark size={18} />
          <span>Free to start. Your ideas stay yours.</span>
        </div>
      </div>
    </div>
  );
}
