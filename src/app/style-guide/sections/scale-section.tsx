"use client";

import { Section } from "./section";

const RADII = ["xs", "sm", "md", "lg", "xl", "2xl"];
const SHADOWS = [
  { name: "card", token: "--sg-shadow-card" },
  { name: "panel", token: "--sg-shadow-panel" },
  { name: "glass", token: "--sg-shadow-glass" },
];
const SPACES = [1, 2, 3, 4, 6, 8, 12, 16];

export function ScaleSection() {
  return (
    <Section
      id="scale"
      eyebrow="Tokens"
      title="Radius · Spacing · Elevation"
      blurb="Fixed scales replace the free-for-all (rounded-full ×115, arbitrary [1.75rem], [2rem], copy-pasted magic shadows)."
    >
      <div style={{ marginBottom: "var(--sg-space-10)" }}>
        <span
          className="sg-label"
          style={{ display: "block", marginBottom: "var(--sg-space-4)" }}
        >
          Radius
        </span>
        <div
          style={{
            display: "flex",
            gap: "var(--sg-space-4)",
            flexWrap: "wrap",
          }}
        >
          {RADII.map((r) => (
            <div key={r} style={{ textAlign: "center" }}>
              <div
                style={{
                  width: 88,
                  height: 88,
                  background: "var(--sg-surface-raised)",
                  border: "1px solid var(--sg-border-strong)",
                  borderRadius: `var(--sg-radius-${r})`,
                }}
              />
              <div
                className="sg-mono"
                style={{
                  fontSize: "var(--sg-text-xs)",
                  color: "var(--sg-text-faint)",
                  marginTop: 6,
                }}
              >
                {r}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: "var(--sg-space-10)" }}>
        <span
          className="sg-label"
          style={{ display: "block", marginBottom: "var(--sg-space-4)" }}
        >
          Spacing (4px base)
        </span>
        <div
          style={{
            display: "flex",
            gap: "var(--sg-space-4)",
            alignItems: "flex-end",
            flexWrap: "wrap",
          }}
        >
          {SPACES.map((s) => (
            <div key={s} style={{ textAlign: "center" }}>
              <div
                style={{
                  width: `var(--sg-space-${s})`,
                  height: `var(--sg-space-${s})`,
                  background: "var(--sg-accent)",
                  borderRadius: 3,
                }}
              />
              <div
                className="sg-mono"
                style={{
                  fontSize: "var(--sg-text-xs)",
                  color: "var(--sg-text-faint)",
                  marginTop: 6,
                }}
              >
                {s}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <span
          className="sg-label"
          style={{ display: "block", marginBottom: "var(--sg-space-4)" }}
        >
          Elevation
        </span>
        <div
          style={{
            display: "flex",
            gap: "var(--sg-space-6)",
            flexWrap: "wrap",
          }}
        >
          {SHADOWS.map((s) => (
            <div key={s.token} style={{ textAlign: "center" }}>
              <div
                style={{
                  width: 150,
                  height: 90,
                  background: "var(--sg-surface)",
                  borderRadius: "var(--sg-radius-lg)",
                  boxShadow: `var(${s.token})`,
                }}
              />
              <div
                className="sg-mono"
                style={{
                  fontSize: "var(--sg-text-xs)",
                  color: "var(--sg-text-faint)",
                  marginTop: 10,
                }}
              >
                {s.name}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}
