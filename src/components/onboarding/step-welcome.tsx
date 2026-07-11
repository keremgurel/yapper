"use client";

import { Button } from "@/components/ui/button";
import { ChirpyMark } from "@/components/brand/chirpy-mark";

/** First screen of onboarding — sets the tone before the data-collection steps.
 * No progress dots yet; just a warm welcome and a single CTA. */
export default function StepWelcome({ onStart }: { onStart: () => void }) {
  return (
    <div className="flex min-h-[540px] flex-col items-center justify-center p-8 text-center">
      <ChirpyMark size={52} />
      <p className="sg-field-label mt-6 text-[color:var(--sg-accent)]">
        Welcome to Yapper Studio
      </p>
      <h2 className="font-display text-foreground mt-2 max-w-sm text-3xl font-black tracking-tight">
        Let&apos;s set up your studio.
      </h2>
      <p className="text-muted-foreground mt-3 max-w-sm text-sm leading-relaxed">
        A few quick things about your content and what inspires you. Takes about
        a minute and makes every idea and script sharper. All of it is optional
        — skip anything and set it up later.
      </p>
      <Button size="lg" onClick={onStart} className="mt-8 sm:px-8">
        Let&apos;s go
      </Button>
    </div>
  );
}
