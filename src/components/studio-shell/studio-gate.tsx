"use client";

import { usePathname } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { SignInButton } from "@clerk/nextjs";
import { Lock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { invoke } from "@/lib/studio/native/bridge";

interface GateCopy {
  eyebrow: string;
  headline: string;
  sub: string;
}

/** The sell for each locked surface. One headline, one line. No filler. */
const COPY: Record<string, GateCopy> = {
  "/studio/library": {
    eyebrow: "Content Library",
    headline: "Your whole content pipeline, from idea to posted.",
    sub: "Capture an idea by voice, turn it into a script, track it to posted.",
  },
  "/studio/ideas": {
    eyebrow: "Idea bank",
    headline: "Every idea and inspiration in one place.",
    sub: "Drop a link or a voice note. We expand it into a ready idea.",
  },
  "/studio/recorder": {
    eyebrow: "Recorder",
    headline: "Record with your script on the teleprompter.",
    sub: "Read off the screen while you record. Every take lands clean.",
  },
  "/studio/editor": {
    eyebrow: "Editor",
    headline: "Edit your video by editing the transcript.",
    sub: "Delete words to cut the video. No timeline scrubbing.",
  },
};

const FALLBACK_COPY: GateCopy = {
  eyebrow: "Yapper Studio",
  headline: "Your studio for videos worth posting.",
  sub: "Idea, script, record, edit. All in one place.",
};

function copyFor(pathname: string): GateCopy {
  const key = Object.keys(COPY).find((k) => pathname.startsWith(k));
  return key ? COPY[key] : FALLBACK_COPY;
}

/** Shown in place of a locked Studio surface when signed out. Short and direct. */
export default function StudioGate() {
  const pathname = usePathname();
  const { eyebrow, headline, sub } = copyFor(pathname);
  const [authError, setAuthError] = useState<string | null>(null);
  const native = useSyncExternalStore(
    () => () => undefined,
    () =>
      navigator.userAgent.includes("YapperStudioNative/") ||
      "__TAURI__" in window,
    () => false,
  );

  async function openBrowserSignIn() {
    setAuthError(null);
    try {
      await invoke("open_auth_flow", {
        url: `${window.location.origin}/studio/native-auth`,
      });
    } catch (error) {
      setAuthError(
        error instanceof Error
          ? error.message
          : "Couldn’t open browser sign-in",
      );
    }
  }

  return (
    <div className="flex min-h-[calc(100svh-8rem)] items-center justify-center px-4 py-10">
      <div className="w-full max-w-md text-center">
        <div className="bg-muted text-foreground/70 mx-auto mb-6 flex h-11 w-11 items-center justify-center rounded-2xl">
          <Lock className="h-5 w-5" />
        </div>

        <p className="mb-3 text-sm font-semibold tracking-wide text-[color:var(--sg-accent)]">
          {eyebrow}
        </p>
        <h1 className="font-display text-foreground text-3xl font-black tracking-tight sm:text-4xl">
          {headline}
        </h1>
        <p className="text-foreground/70 mx-auto mt-4 max-w-sm text-base leading-relaxed">
          {sub}
        </p>

        <div className="mt-8 flex flex-col items-center gap-3">
          {native ? (
            <Button
              size="lg"
              className="w-full max-w-xs"
              onClick={openBrowserSignIn}
            >
              Sign in in your browser
            </Button>
          ) : (
            <SignInButton mode="modal" withSignUp>
              <Button size="lg" className="w-full max-w-xs">
                Start free
              </Button>
            </SignInButton>
          )}
          {!native && (
            <SignInButton mode="modal">
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground text-sm font-semibold"
              >
                I already have an account
              </button>
            </SignInButton>
          )}
          {authError && (
            <p className="text-destructive max-w-xs text-sm" role="alert">
              {authError}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
