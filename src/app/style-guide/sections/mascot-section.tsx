"use client";

import { Section } from "./section";
import { BirdMascot, type ChirpyExpression } from "../mascot/bird-mascot";

const SCENARIOS: {
  expression: ChirpyExpression;
  talking?: boolean;
  name: string;
  where: string;
}[] = [
  { expression: "idle", name: "Idle", where: "resting on the home hero" },
  {
    expression: "yap",
    talking: true,
    name: "Yapping",
    where: "while a topic generates",
  },
  {
    expression: "happy",
    talking: true,
    name: "Happy",
    where: "you finished a rep",
  },
  { expression: "curious", name: "Curious", where: "prompts / tooltips" },
  { expression: "wink", name: "Wink", where: "nudges + easter eggs" },
  { expression: "oops", name: "Oops", where: "empty + error states" },
];

/**
 * Chirpy, our chosen mascot, across scenarios. Same bird, swappable
 * brows/eyes/beak — one character that carries mood through the whole app.
 */
export function MascotSection() {
  return (
    <Section
      id="mascot"
      eyebrow="Brand"
      title="Meet Chirpy"
      blurb="Our mascot: a bird that will not stop chirping. One character, swappable expressions (Aave-emotion-scale style) so Chirpy fits every moment. Next: the logomark lockup with the wordmark, plus loading and celebration poses."
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
          gap: "var(--sg-space-5)",
        }}
      >
        {SCENARIOS.map((s) => (
          <div
            key={s.name}
            className="sg-card"
            style={{
              padding: "var(--sg-space-6)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "var(--sg-space-3)",
              textAlign: "center",
            }}
          >
            <BirdMascot
              concept="chirpy"
              expression={s.expression}
              talking={s.talking}
              size={120}
            />
            <div>
              <h3
                className="sg-display"
                style={{ fontSize: "var(--sg-text-lg)" }}
              >
                {s.name}
              </h3>
              <p
                style={{
                  color: "var(--sg-text-muted)",
                  fontSize: "var(--sg-text-xs)",
                  marginTop: 4,
                }}
              >
                {s.where}
              </p>
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}
