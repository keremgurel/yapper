"use client";

import { useState } from "react";
import { Section } from "./section";
import { CollapseToggle } from "../components/collapse-toggle";

const ITEMS = [
  {
    q: "How do I generate a topic?",
    a: "Pull the GENERATE lever. Yapper hands you a random impromptu prompt and starts the timer.",
  },
  {
    q: "Can I record myself?",
    a: "Yes. Enable camera or mic before you pull the lever and the session is saved for review.",
  },
  {
    q: "Is it free?",
    a: "The practice rep is free forever. Guided programs are the premium layer you can join the waitlist for.",
  },
];

/**
 * FAQ collapse — the +/× toggle you like, tokenized into <CollapseToggle/>.
 * Rows use one card shape; the toggle rotates a plus into an ×.
 */
export function FaqSection() {
  return (
    <Section
      id="faq"
      eyebrow="Components"
      title="Collapse rows"
      blurb="Your FAQ toggle, promoted to a component: a plus that rotates 45° into an ×, flipping to a filled chip when open. One row shape, tokenized."
    >
      <div
        className="sg-card"
        style={{ padding: "var(--sg-space-2) var(--sg-space-6)" }}
      >
        {ITEMS.map((it, i) => (
          <FaqRow key={i} q={it.q} a={it.a} last={i === ITEMS.length - 1} />
        ))}
      </div>
    </Section>
  );
}

function FaqRow({ q, a, last }: { q: string; a: string; last: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderBottom: last ? "none" : "1px solid var(--sg-border)" }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "var(--sg-space-4)",
          padding: "var(--sg-space-5) 0",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          color: "var(--sg-text)",
          fontFamily: "var(--sg-font-display)",
          fontSize: "var(--sg-text-md)",
          fontWeight: 600,
          textAlign: "left",
        }}
      >
        {q}
        <CollapseToggle open={open} />
      </button>
      {open && (
        <p
          style={{
            color: "var(--sg-text-muted)",
            padding: "0 0 var(--sg-space-5)",
            maxWidth: 620,
            lineHeight: 1.5,
          }}
        >
          {a}
        </p>
      )}
    </div>
  );
}
