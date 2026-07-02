"use client";

import { Section } from "./section";
import { GlassyButton } from "@/components/ui/glassy-button";

/**
 * A tokenized take on the loved "Get early access" glow-line form — same
 * gesture (input + accent glow underline + CTA), now built from tokens so it
 * recolors per direction instead of hardcoded indigo/sky.
 */
export function WaitlistSection() {
  return (
    <Section
      id="waitlist"
      eyebrow="Pattern"
      title="Get early access"
      blurb="Your animated waitlist form, re-expressed in tokens. The glow line reads from the accent colors, so it stays on-brand in light and dark."
    >
      <div style={{ maxWidth: 560 }}>
        <div
          className="sg-glass"
          style={{
            padding: "var(--sg-space-3)",
            display: "flex",
            gap: "var(--sg-space-2)",
            position: "relative",
          }}
        >
          <input
            placeholder="Enter your email"
            style={{
              flex: 1,
              background: "var(--sg-surface-sunken)",
              border: "1px solid var(--sg-border)",
              borderRadius: "var(--sg-radius-md)",
              padding: "var(--sg-space-3) var(--sg-space-4)",
              color: "var(--sg-text)",
              fontFamily: "var(--sg-font-body)",
              fontSize: "var(--sg-text-md)",
              outline: "none",
            }}
          />
          <GlassyButton height={46}>Join Waitlist</GlassyButton>

          {/* animated glow underline */}
          <span
            aria-hidden
            style={{
              position: "absolute",
              left: "10%",
              right: "10%",
              bottom: -1,
              height: 2,
              borderRadius: 2,
              background:
                "linear-gradient(90deg, transparent, var(--sg-accent), var(--sg-accent-2), transparent)",
              filter: "blur(1px)",
              animation: "sgGlow 3.2s var(--sg-ease-in-out) infinite",
            }}
          />
        </div>
        <style>{`
          @keyframes sgGlow {
            0%, 100% { opacity: 0.4; transform: scaleX(0.9); }
            50% { opacity: 1; transform: scaleX(1); }
          }
          @media (prefers-reduced-motion: reduce) {
            [style*="sgGlow"] { animation: none !important; }
          }
        `}</style>
      </div>
    </Section>
  );
}
