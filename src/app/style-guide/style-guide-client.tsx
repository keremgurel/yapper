"use client";

import { useState } from "react";
import "./tokens.primitives.css";
import "./tokens.themes.css";
import "./tokens.components.css";
import { hanken } from "./fonts";
import { MODES, type ModeKey } from "./directions";
import { ThemeSwitcher } from "./theme-switcher";
import { BrandHeroSection } from "./sections/brand-hero-section";
import { ColorSection } from "./sections/color-section";
import { TypeSection } from "./sections/type-section";
import { ScaleSection } from "./sections/scale-section";
import { AuroraSection } from "./sections/aurora-section";
import { GlassSection } from "./sections/glass-section";
import { ButtonSection } from "./sections/button-section";
import { FaqSection } from "./sections/faq-section";
import { ControlsSection } from "./sections/controls-section";
import { SurfaceSection } from "./sections/surface-section";
import { WaitlistSection } from "./sections/waitlist-section";
import { MascotSection } from "./sections/mascot-section";

/**
 * Style guide shell. Owns exactly one piece of state — the active mode
 * (light/dark) — and paints it onto [data-sg-theme] so every token-driven child
 * re-themes at once. Scoped under [data-sg]; never touches globals.css.
 */
export function StyleGuideClient() {
  const [mode, setMode] = useState<ModeKey>("dark");
  const modeName = MODES.find((m) => m.key === mode)!.name;

  return (
    <div
      data-sg
      data-sg-theme={mode}
      className={hanken.variable}
      style={{ minHeight: "100vh", background: "var(--sg-bg)" }}
    >
      <ThemeSwitcher active={mode} onChange={setMode} />
      <BrandHeroSection />
      <ColorSection />
      <TypeSection />
      <ScaleSection />
      <AuroraSection />
      <GlassSection />
      <ButtonSection />
      <FaqSection />
      <ControlsSection />
      <SurfaceSection />
      <WaitlistSection />
      <MascotSection />
      <footer
        style={{
          padding: "var(--sg-space-16) var(--sg-space-5)",
          textAlign: "center",
          color: "var(--sg-text-faint)",
        }}
      >
        <span className="sg-label">Draft · {modeName} mode</span>
        <p style={{ marginTop: 8, fontSize: "var(--sg-text-sm)" }}>
          Scoped to /style-guide. Nothing here is live on the site yet.
        </p>
      </footer>
    </div>
  );
}
