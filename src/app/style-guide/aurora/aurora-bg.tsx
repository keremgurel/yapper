"use client";

import { MeshGradient } from "@paper-design/shaders-react";

/**
 * Aurora — the animated mesh-gradient background you love from the practice
 * stage, promoted to a reusable design-system component. Same shader
 * (@paper-design/shaders-react) and the same motion feel; palette is a token so
 * it stays cohesive (single hue family + one warm kiss), never a rainbow.
 *
 * One responsibility: paint an animated aurora behind its container.
 */

export type AuroraPalette = "teal" | "warm" | "violet";

const PALETTES: Record<AuroraPalette, string[]> = {
  // the exact set from the practice stage: teal-forward with an orange kiss
  teal: ["#000000", "#06b6d4", "#0891b2", "#164e63", "#f97316"],
  // brand-warm: orange/amber over deep ink
  warm: ["#0a0a0a", "#f97316", "#fb8b2e", "#7c2d12", "#f9a825"],
  // cool alt
  violet: ["#000000", "#7c6cff", "#4c3fb5", "#1e1b4b", "#22d3ee"],
};

export function Aurora({
  palette = "teal",
  speed = 0.3,
  distortion = 0.4,
  swirl = 0.3,
  className,
}: {
  palette?: AuroraPalette;
  speed?: number;
  distortion?: number;
  swirl?: number;
  className?: string;
}) {
  return (
    <MeshGradient
      className={className}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
      colors={PALETTES[palette]}
      speed={speed}
      distortion={distortion}
      swirl={swirl}
    />
  );
}
