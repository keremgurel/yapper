"use client";

import { BirdMascot } from "@/components/brand/bird-mascot";
import { Aurora } from "../aurora/aurora-bg";
import { GlassyButton } from "@/components/ui/glassy-button";
import { BRAND } from "../directions";

/**
 * Hero — the Aurora surface (teal, from the practice stage) with a glass card
 * on top: bird mascot + wordmark + CTAs. Glass over a SOLID moving aurora, the
 * one place the "glass over color" recipe shines.
 */
export function BrandHeroSection() {
  return (
    <header
      style={{
        maxWidth: 1100,
        margin: "0 auto",
        padding: "var(--sg-space-12) var(--sg-space-5)",
      }}
    >
      <div
        style={{
          position: "relative",
          borderRadius: "var(--sg-radius-2xl)",
          overflow: "hidden",
          border: "1px solid var(--sg-border)",
        }}
      >
        <Aurora palette="teal" />
        <div
          className="sg-glass"
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            gap: "var(--sg-space-10)",
            flexWrap: "wrap",
            padding: "var(--sg-space-12)",
            margin: "var(--sg-space-6)",
            borderRadius: "var(--sg-radius-2xl)",
          }}
        >
          <BirdMascot concept="chirpy" talking size={140} />
          <div style={{ flex: "1 1 320px" }}>
            <span className="sg-chip">
              <span className="sg-chip-dot" />
              {BRAND.tagline}
            </span>
            <h1
              className="sg-display"
              style={{
                fontSize: "var(--sg-text-6xl)",
                margin: "var(--sg-space-4) 0 0",
                color: "#fff",
              }}
            >
              {BRAND.name}
            </h1>
            <p
              style={{
                color: "rgba(255,255,255,0.82)",
                fontSize: "var(--sg-text-lg)",
                lineHeight: 1.45,
                maxWidth: 500,
                margin: "var(--sg-space-4) 0 0",
              }}
            >
              {BRAND.blurb}
            </p>
            <div
              style={{
                display: "flex",
                gap: "var(--sg-space-3)",
                marginTop: "var(--sg-space-6)",
                alignItems: "center",
              }}
            >
              <GlassyButton height={46}>Jump to practice</GlassyButton>
              <button className="sg-btn-accent">Join waitlist</button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
