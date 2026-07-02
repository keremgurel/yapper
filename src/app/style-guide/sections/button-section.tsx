"use client";

import { Section } from "./section";
import { GlassyButton } from "@/components/ui/glassy-button";

/**
 * The button family. The aluminum button is the REAL <GlassyButton/> (with its
 * click sound), never a CSS clone. Accent + ghost + chip are token-driven.
 */
export function ButtonSection() {
  return (
    <Section
      id="buttons"
      eyebrow="Components"
      title="Buttons"
      blurb="Aluminum (your real GlassyButton, primary tactile), accent (the orange CTA), ghost (secondary), plus chips. One aluminum button exists in the whole app."
    >
      <div
        style={{
          display: "flex",
          gap: "var(--sg-space-4)",
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <GlassyButton height={46}>Jump to practice</GlassyButton>
        <button className="sg-btn-accent">Join waitlist</button>
        <button className="sg-btn-ghost">Skip for now</button>
        <span className="sg-chip">
          <span className="sg-chip-dot" />
          New
        </span>
        <span className="sg-chip">
          <span className="sg-chip-dot sg-chip-dot--live" />
          Recording
        </span>
      </div>
    </Section>
  );
}
