"use client";

import { useState } from "react";
import { Section } from "./section";
import SlotLever from "@/components/SlotLever";
import RotaryKnob from "@/components/RotaryKnob";

/**
 * The tactile hardware, housed in a glass panel — the core "analog studio"
 * gesture. These are the untouched real components; the panel around them is
 * the tokenized system showing how they get framed consistently.
 */
export function ControlsSection() {
  const [seconds, setSeconds] = useState(60);
  return (
    <Section
      id="controls"
      eyebrow="Signature"
      title="Tactile controls"
      blurb="The GENERATE lever and TIMER knob are the soul of the brand. They live on a dark studio panel, and the system's job is to house them consistently, not to change them."
    >
      <div
        style={{
          display: "flex",
          gap: "var(--sg-space-10)",
          justifyContent: "center",
          alignItems: "center",
          flexWrap: "wrap",
          padding: "var(--sg-space-12) var(--sg-space-8)",
          background: "var(--sg-ink-900)",
          border: "1px solid var(--sg-border)",
          borderRadius: "var(--sg-radius-2xl)",
          boxShadow: "var(--sg-shadow-panel)",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "var(--sg-space-4)",
          }}
        >
          <SlotLever onPull={() => {}} />
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "var(--sg-space-4)",
          }}
        >
          <RotaryKnob value={seconds} onChange={setSeconds} min={30} max={90} />
        </div>
      </div>
    </Section>
  );
}
