"use client";

import { Section } from "./section";

const SEMANTIC: { name: string; token: string }[] = [
  { name: "bg", token: "--sg-bg" },
  { name: "surface", token: "--sg-surface" },
  { name: "surface-raised", token: "--sg-surface-raised" },
  { name: "surface-sunken", token: "--sg-surface-sunken" },
  { name: "border", token: "--sg-border" },
  { name: "text", token: "--sg-text" },
  { name: "text-muted", token: "--sg-text-muted" },
  { name: "text-faint", token: "--sg-text-faint" },
];

const ACCENTS: { name: string; token: string }[] = [
  { name: "accent", token: "--sg-accent" },
  { name: "accent-2", token: "--sg-accent-2" },
  { name: "accent-3", token: "--sg-accent-3" },
];

const INK = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];

export function ColorSection() {
  return (
    <Section
      id="color"
      eyebrow="Tokens"
      title="Color"
      blurb="One neutral ink ramp + a small semantic layer + accents. Every component reads these — no more 16 raw Tailwind palettes scattered across the app."
    >
      <Group label="Semantic surfaces & text">
        {SEMANTIC.map((s) => (
          <Swatch key={s.token} name={s.name} token={s.token} />
        ))}
      </Group>
      <Group label="Accents">
        <div style={{ width: 150 }}>
          <div
            style={{
              height: 76,
              borderRadius: "var(--sg-radius-md)",
              background: "var(--sg-accent-gradient)",
              border: "1px solid var(--sg-border)",
              boxShadow: "var(--sg-shadow-card)",
            }}
          />
          <div style={{ marginTop: "var(--sg-space-2)" }}>
            <div style={{ fontSize: "var(--sg-text-sm)", fontWeight: 600 }}>
              brand gradient
            </div>
            <div
              className="sg-mono"
              style={{
                fontSize: "var(--sg-text-xs)",
                color: "var(--sg-text-faint)",
              }}
            >
              --sg-accent-gradient
            </div>
          </div>
        </div>
        {ACCENTS.map((s) => (
          <Swatch key={s.token} name={s.name} token={s.token} big />
        ))}
      </Group>
      <Group label="Ink ramp (primitive)">
        <div
          style={{
            display: "flex",
            borderRadius: "var(--sg-radius-md)",
            overflow: "hidden",
            flex: 1,
          }}
        >
          {INK.map((n) => (
            <div
              key={n}
              title={`--sg-ink-${n}`}
              style={{
                flex: 1,
                height: 56,
                background: `var(--sg-ink-${n})`,
              }}
            />
          ))}
        </div>
      </Group>
    </Section>
  );
}

function Group({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: "var(--sg-space-8)" }}>
      <span
        className="sg-label"
        style={{ display: "block", marginBottom: "var(--sg-space-3)" }}
      >
        {label}
      </span>
      <div
        style={{
          display: "flex",
          gap: "var(--sg-space-3)",
          flexWrap: "wrap",
          alignItems: "stretch",
        }}
      >
        {children}
      </div>
    </div>
  );
}

function Swatch({
  name,
  token,
  big,
}: {
  name: string;
  token: string;
  big?: boolean;
}) {
  return (
    <div style={{ width: big ? 150 : 120 }}>
      <div
        style={{
          height: big ? 76 : 56,
          borderRadius: "var(--sg-radius-md)",
          background: `var(${token})`,
          border: "1px solid var(--sg-border)",
          boxShadow: "var(--sg-shadow-card)",
        }}
      />
      <div style={{ marginTop: "var(--sg-space-2)" }}>
        <div style={{ fontSize: "var(--sg-text-sm)", fontWeight: 600 }}>
          {name}
        </div>
        <div
          className="sg-mono"
          style={{
            fontSize: "var(--sg-text-xs)",
            color: "var(--sg-text-faint)",
          }}
        >
          {token}
        </div>
      </div>
    </div>
  );
}
