"use client";

import { Plus, Scissors, Sparkles, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Chirpy } from "@/components/brand/chirpy";

const STORY = [
  {
    icon: Sparkles,
    title: "Save what stops your scroll",
    body: "Paste a YouTube, TikTok, or Instagram link. We grab the title, thumbnail, and transcript automatically.",
  },
  {
    icon: Scissors,
    title: "See why it works",
    body: "We break down the hook, the story, and the moves that made it land — so you learn, not just collect.",
  },
  {
    icon: Wand2,
    title: "Make it yours",
    body: "Turn any clip into a fresh idea in your own voice, ready to script and record.",
  },
];

/** The first thing a brand-new user sees in Inspiration. One idea, told simply:
 * this is your swipe file, and here's how it turns into your own videos. No
 * rail, no filters, no clutter — just the story and one clear action. */
export default function InspirationEmptyState({
  onAdd,
}: {
  onAdd: () => void;
}) {
  return (
    <div className="mx-auto flex min-h-[62svh] w-full max-w-2xl flex-col items-center justify-center px-4 py-10 text-center">
      <Chirpy expression="curious" size={92} />
      <p className="sg-field-label mt-6 text-[color:var(--sg-accent)]">
        Inspiration
      </p>
      <h1 className="font-display text-foreground mt-2 max-w-lg text-3xl font-black tracking-tight sm:text-4xl">
        Your swipe file of what great looks like.
      </h1>
      <p className="text-muted-foreground mt-3 max-w-md text-base leading-relaxed">
        Keep the videos and creators that inspire you in one place — then turn
        them into content that&apos;s unmistakably yours.
      </p>

      <Button size="lg" onClick={onAdd} className="mt-8 sm:px-8">
        <Plus className="h-4 w-4" />
        Add your first link
      </Button>

      <div className="mt-12 grid w-full gap-3 text-left sm:grid-cols-3">
        {STORY.map((s) => (
          <div key={s.title} className="sg-sunken p-4">
            <span className="flex h-9 w-9 items-center justify-center rounded-md bg-[color:var(--sg-accent)]/15 text-[color:var(--sg-accent)]">
              <s.icon className="h-4 w-4" />
            </span>
            <p className="text-foreground mt-3 text-sm font-bold">{s.title}</p>
            <p className="text-muted-foreground mt-1 text-[13px] leading-relaxed">
              {s.body}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
