"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { Mic, Video, Scissors, ArrowRight, Sparkles, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import StudioNavIcon from "@/components/studio-shell/studio-nav-icon";
import { studioNav } from "@/data/studio-nav";

/**
 * The app home: a launcher, not a marketing page. Opens straight into "what do
 * you want to make" with the three primary actions, the rest of the surfaces as
 * quick links, and a single non-blocking hint that the app gets smarter as you
 * connect things — never a wall, never forced. This is what the native app
 * window opens onto (instead of the /studio marketing page).
 */

const PRIMARY = [
  {
    title: "New idea",
    sub: "Voice-note or type it. We keep your words and build the hooks, outline, and full script.",
    href: "/studio/ideas",
    Icon: Mic,
  },
  {
    title: "Record",
    sub: "Read off the built-in teleprompter and capture your take.",
    href: "/studio/recorder",
    Icon: Video,
  },
  {
    title: "Editor",
    sub: "Import a clip and cut it clean by editing the transcript.",
    href: "/studio/editor",
    Icon: Scissors,
  },
] as const;

const HINT_KEY = "yapper.home.smartHintDismissed";
const hintListeners = new Set<() => void>();

function subscribeToHint(onChange: () => void): () => void {
  hintListeners.add(onChange);
  return () => hintListeners.delete(onChange);
}

function getHintSnapshot(): boolean {
  return localStorage.getItem(HINT_KEY) !== "1";
}

function getServerHintSnapshot(): boolean {
  return false;
}

export default function StudioHomePage() {
  // Secondary surfaces = everything except the three primary actions above.
  const primaryHrefs = new Set<string>(PRIMARY.map((p) => p.href));
  const surfaces = studioNav.filter((s) => !primaryHrefs.has(s.href));

  const showHint = useSyncExternalStore(
    subscribeToHint,
    getHintSnapshot,
    getServerHintSnapshot,
  );
  const dismissHint = () => {
    localStorage.setItem(HINT_KEY, "1");
    for (const listener of hintListeners) listener();
  };

  return (
    <div className="mx-auto w-full max-w-6xl">
      <header className="mb-8">
        <h1 className="sg-display text-foreground text-3xl font-black sm:text-4xl">
          What do you want to make?
        </h1>
        <p className="text-muted-foreground mt-2 text-sm sm:text-base">
          Capture an idea, record a take, or edit a clip. Everything else is one
          click away.
        </p>
      </header>

      {/* Three primary actions */}
      <div className="grid gap-4 sm:grid-cols-3">
        {PRIMARY.map(({ title, sub, href, Icon }) => (
          <Link key={href} href={href} className="no-underline">
            <Card className="group h-full gap-0 p-5 transition-colors hover:border-[color:var(--sg-accent)]/50">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[color:var(--sg-accent)]/12 text-[color:var(--sg-accent)]">
                <Icon className="h-5 w-5" />
              </span>
              <div className="mt-4 flex items-center gap-1.5">
                <h2 className="text-foreground text-lg font-black">{title}</h2>
                <ArrowRight className="text-muted-foreground h-4 w-4 -translate-x-1 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
              </div>
              <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
                {sub}
              </p>
            </Card>
          </Link>
        ))}
      </div>

      {/* Non-blocking "gets smarter" hint — optional, dismissible, never a wall */}
      {showHint && (
        <div className="mt-6 flex items-start gap-3 rounded-xl border border-[color:var(--sg-accent)]/25 bg-[color:var(--sg-accent)]/[0.06] p-4">
          <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-[color:var(--sg-accent)]" />
          <div className="min-w-0 flex-1">
            <p className="text-foreground text-sm font-semibold">
              Yapper gets sharper the more it knows about you
            </p>
            <p className="text-muted-foreground mt-0.5 text-sm leading-relaxed">
              Connect your accounts and we&apos;ll read your recent posts to
              build your content pillars automatically. You just edit them.
              Totally optional, everything works without it.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button asChild size="sm">
              <Link href="/studio/connections">Connect</Link>
            </Button>
            <button
              onClick={dismissHint}
              aria-label="Dismiss"
              className="text-muted-foreground hover:text-foreground rounded-md p-1.5 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Everything else */}
      <h3 className="text-muted-foreground mt-10 mb-3 text-xs font-semibold tracking-wider uppercase">
        Everything else
      </h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {surfaces.map((s) => (
          <Link key={s.href} href={s.href} className="no-underline">
            <Card className="hover:border-border/80 hover:bg-muted/30 flex-row items-center gap-3 p-4 transition-colors">
              <span className="bg-muted text-foreground flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border">
                <StudioNavIcon icon={s.icon} className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="text-foreground text-sm font-bold">{s.title}</p>
                <p className="text-muted-foreground truncate text-xs">
                  {s.description}
                </p>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
