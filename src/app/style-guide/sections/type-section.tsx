"use client";

import { Section } from "./section";

const SCALE: { name: string; token: string; sample: string }[] = [
  { name: "6xl / Display", token: "--sg-text-6xl", sample: "Speak with reps" },
  { name: "4xl / H1", token: "--sg-text-4xl", sample: "Practice out loud" },
  { name: "2xl / H2", token: "--sg-text-2xl", sample: "One rep at a time" },
  { name: "xl / H3", token: "--sg-text-xl", sample: "Pick a prompt and go" },
  {
    name: "lg / Lead",
    token: "--sg-text-lg",
    sample: "A tactile studio for your voice.",
  },
  {
    name: "md / Body",
    token: "--sg-text-md",
    sample:
      "The quick brown fox jumps over the lazy dog while rehearsing a two minute answer.",
  },
  {
    name: "sm / Small",
    token: "--sg-text-sm",
    sample: "Supporting copy and captions.",
  },
  {
    name: "xs / Label",
    token: "--sg-text-xs",
    sample: "GENERATE · TIMER · DRAG TO SET",
  },
];

export function TypeSection() {
  return (
    <Section
      id="type"
      eyebrow="Tokens"
      title="Typography"
      blurb="One geo-grotesque family (Hanken Grotesk — our free stand-in for Aave's FT Regola Neue) across display and body, Geist Mono for numerals. One fluid scale replaces the ad-hoc text-[9px]…text-[72px] sprawl."
    >
      <div
        style={{
          display: "flex",
          gap: "var(--sg-space-8)",
          flexWrap: "wrap",
          marginBottom: "var(--sg-space-10)",
        }}
      >
        <FamilyCard
          family="var(--sg-font-display)"
          name="Hanken Grotesk"
          role="Display + body"
        />
        <FamilyCard
          family="var(--sg-font-mono)"
          name="Geist Mono"
          role="Numerals / timer"
          mono
        />
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--sg-space-5)",
        }}
      >
        {SCALE.map((s) => (
          <div
            key={s.token}
            style={{
              display: "flex",
              gap: "var(--sg-space-5)",
              alignItems: "baseline",
              flexWrap: "wrap",
            }}
          >
            <div style={{ width: 130, flexShrink: 0 }}>
              <div className="sg-label">{s.name}</div>
              <div
                className="sg-mono"
                style={{
                  fontSize: "var(--sg-text-xs)",
                  color: "var(--sg-text-faint)",
                }}
              >
                {s.token}
              </div>
            </div>
            <div
              className={
                s.token.includes("6xl") ||
                s.token.includes("4xl") ||
                s.token.includes("2xl")
                  ? "sg-display"
                  : undefined
              }
              style={{
                fontSize: `var(${s.token})`,
                color: "var(--sg-text)",
                lineHeight: 1.2,
                flex: 1,
                minWidth: 240,
              }}
            >
              {s.sample}
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

function FamilyCard({
  family,
  name,
  role,
  mono,
}: {
  family: string;
  name: string;
  role: string;
  mono?: boolean;
}) {
  return (
    <div
      className="sg-card"
      style={{ padding: "var(--sg-space-5)", minWidth: 220, flex: 1 }}
    >
      <div
        style={{
          fontFamily: family,
          fontSize: "var(--sg-text-4xl)",
          fontWeight: 700,
          letterSpacing: mono ? 0 : "-0.02em",
        }}
      >
        Aa
      </div>
      <div
        style={{
          fontFamily: family,
          fontSize: "var(--sg-text-md)",
          color: "var(--sg-text-muted)",
          marginTop: "var(--sg-space-2)",
        }}
      >
        {mono ? "0123456789" : "AaBbCc 0123"}
      </div>
      <div style={{ marginTop: "var(--sg-space-4)" }}>
        <div style={{ fontWeight: 600 }}>{name}</div>
        <div
          style={{
            fontSize: "var(--sg-text-sm)",
            color: "var(--sg-text-faint)",
          }}
        >
          {role}
        </div>
      </div>
    </div>
  );
}
