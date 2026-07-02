"use client";

import { Section } from "./section";

/**
 * Aave-style surfaces: one card shape, generous padding, clear hierarchy
 * (eyebrow → big display value → muted caption). Directly replaces /training's
 * cards-within-cards. Nothing nested, everything aligned, lots of breathing room.
 */

const STATS = [
  { tag: "Random Topic", value: "60s", caption: "impromptu speaking rep." },
  { tag: "Read Aloud", value: "90s", caption: "guided clarity drill." },
  { tag: "Freestyle", value: "∞", caption: "no timer, just talk." },
  { tag: "Interview", value: "45s", caption: "rapid pressure answers." },
];

export function SurfaceSection() {
  return (
    <Section
      id="surfaces"
      eyebrow="Components"
      title="One card, real breathing room"
      blurb="Aave's card discipline: a single shape, one radius, one elevation, and generous padding. Eyebrow, one big value, a muted caption. This is the fix for /training's nested boxes."
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
          gap: "var(--sg-space-5)",
        }}
      >
        {STATS.map((s) => (
          <article
            key={s.tag}
            className="sg-card"
            style={{
              padding: "var(--sg-space-8)",
              display: "flex",
              flexDirection: "column",
              gap: "var(--sg-space-6)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--sg-space-3)",
              }}
            >
              <span
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: "var(--sg-radius-sm)",
                  background: "var(--sg-accent)",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--sg-accent-fg)",
                  fontWeight: 800,
                  fontSize: 14,
                }}
              >
                Y
              </span>
              <span style={{ fontWeight: 600, color: "var(--sg-text-muted)" }}>
                {s.tag}
              </span>
            </div>
            <div>
              <div
                className="sg-display"
                style={{ fontSize: "var(--sg-text-4xl)", lineHeight: 1 }}
              >
                {s.value}
              </div>
              <p
                style={{
                  color: "var(--sg-text-muted)",
                  marginTop: "var(--sg-space-2)",
                }}
              >
                {s.caption}
              </p>
            </div>
          </article>
        ))}
      </div>

      <div
        style={{
          marginTop: "var(--sg-space-8)",
          display: "flex",
          gap: "var(--sg-space-5)",
          flexWrap: "wrap",
        }}
      >
        <div
          className="sg-panel"
          style={{ flex: "1 1 320px", padding: "var(--sg-space-10)" }}
        >
          <span className="sg-label">Panel</span>
          <h3
            className="sg-display"
            style={{ fontSize: "var(--sg-text-2xl)", margin: "10px 0" }}
          >
            Section container
          </h3>
          <p style={{ color: "var(--sg-text-muted)" }}>
            Panels group cards. They never contain other panels — the recursion
            stops here.
          </p>
        </div>
        <div
          className="sg-sunken"
          style={{ flex: "1 1 320px", padding: "var(--sg-space-10)" }}
        >
          <span className="sg-label">Sunken</span>
          <h3
            className="sg-display"
            style={{ fontSize: "var(--sg-text-2xl)", margin: "10px 0" }}
          >
            Inset well
          </h3>
          <p style={{ color: "var(--sg-text-muted)" }}>
            For inputs, transcripts, and read-only content that should recede.
          </p>
        </div>
      </div>
    </Section>
  );
}
