"use client";

import { Section } from "./section";
import { Aurora, type AuroraPalette } from "../aurora/aurora-bg";

const PALETTES: { key: AuroraPalette; name: string }[] = [
  { key: "teal", name: "Teal (practice stage)" },
  { key: "warm", name: "Warm (brand)" },
  { key: "violet", name: "Violet" },
];

/**
 * Aurora — your animated mesh-gradient background, now a documented component.
 * Cohesive single-hue-family palettes (never rainbow), same motion as the
 * practice stage.
 */
export function AuroraSection() {
  return (
    <Section
      id="aurora"
      eyebrow="Signature surface"
      title="Aurora background"
      blurb="The living mesh-gradient you love from the practice stage, promoted to a reusable <Aurora/> component. Tokenized palettes keep it cohesive — teal-forward with a warm kiss, a brand-warm variant, and a cool violet."
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: "var(--sg-space-5)",
        }}
      >
        {PALETTES.map((p) => (
          <div key={p.key}>
            <div
              style={{
                position: "relative",
                height: 200,
                borderRadius: "var(--sg-radius-2xl)",
                overflow: "hidden",
                border: "1px solid var(--sg-border)",
              }}
            >
              <Aurora palette={p.key} />
            </div>
            <div
              className="sg-mono"
              style={{
                fontSize: "var(--sg-text-xs)",
                color: "var(--sg-text-faint)",
                marginTop: 8,
              }}
            >
              {p.name}
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}
