"use client";

import { Section } from "./section";
import { Aurora } from "../aurora/aurora-bg";

/**
 * Glass, used with restraint. Aave's glass sits over depth (a photo or a moving
 * aurora), never over a flat saturated fill — that's what made text wash out.
 * Here .sg-glass panels sit over the Aurora, with light text, the readable
 * recipe.
 */
export function GlassSection() {
  return (
    <Section
      id="glass"
      eyebrow="Surfaces"
      title="Glass, with restraint"
      blurb="One tokenized glass treatment (.sg-glass): subtle backdrop-blur plus a specular rim, always over depth (the aurora or a photo), never over a flat color. Light text on top so it stays readable."
    >
      <div
        style={{
          position: "relative",
          borderRadius: "var(--sg-radius-2xl)",
          overflow: "hidden",
          padding: "var(--sg-space-12)",
          border: "1px solid var(--sg-border)",
        }}
      >
        <Aurora palette="teal" />
        <div
          style={{
            position: "relative",
            display: "flex",
            gap: "var(--sg-space-6)",
            flexWrap: "wrap",
          }}
        >
          <GlassCard
            label=".sg-glass"
            title="Frosted overlay"
            body="Backdrop-blur plus a 1px specular rim, straight from tokens."
          />
          <GlassCard
            label="Toolbar / menu"
            title="Same recipe"
            body="One glass class everywhere, so overlays feel identical app-wide."
          />
        </div>
      </div>
    </Section>
  );
}

function GlassCard({
  label,
  title,
  body,
}: {
  label: string;
  title: string;
  body: string;
}) {
  return (
    <div
      className="sg-glass"
      style={{
        flex: "1 1 260px",
        padding: "var(--sg-space-6)",
        minHeight: 140,
      }}
    >
      <span className="sg-label" style={{ color: "rgba(255,255,255,0.7)" }}>
        {label}
      </span>
      <h3
        className="sg-display"
        style={{
          fontSize: "var(--sg-text-xl)",
          margin: "8px 0 4px",
          color: "#fff",
        }}
      >
        {title}
      </h3>
      <p
        style={{
          color: "rgba(255,255,255,0.82)",
          fontSize: "var(--sg-text-sm)",
        }}
      >
        {body}
      </p>
    </div>
  );
}
