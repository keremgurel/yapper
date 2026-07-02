"use client";

import { MODES, type ModeKey } from "./directions";

/** Sticky top switcher. One job: toggle light/dark for the single system. */
export function ThemeSwitcher({
  active,
  onChange,
}: {
  active: ModeKey;
  onChange: (k: ModeKey) => void;
}) {
  return (
    <div
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        display: "flex",
        flexWrap: "wrap",
        gap: "var(--sg-space-2)",
        alignItems: "center",
        padding: "var(--sg-space-3) var(--sg-space-5)",
        background: "color-mix(in oklab, var(--sg-bg) 82%, transparent)",
        borderBottom: "1px solid var(--sg-border)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
      }}
    >
      <span className="sg-label" style={{ marginRight: "auto" }}>
        Yapper · Style Guide
      </span>
      {MODES.map((m) => {
        const isActive = m.key === active;
        return (
          <button
            key={m.key}
            onClick={() => onChange(m.key)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--sg-space-2)",
              padding: "var(--sg-space-2) var(--sg-space-4)",
              borderRadius: "var(--sg-radius-full)",
              border: `1px solid ${isActive ? "var(--sg-accent)" : "var(--sg-border-strong)"}`,
              background: isActive
                ? "color-mix(in oklab, var(--sg-accent) 14%, transparent)"
                : "transparent",
              color: "var(--sg-text)",
              fontFamily: "var(--sg-font-display)",
              fontSize: "var(--sg-text-sm)",
              fontWeight: 600,
              cursor: "pointer",
              transition: "border-color 140ms ease, background 140ms ease",
            }}
          >
            <span style={{ display: "inline-flex", gap: 2 }}>
              {m.swatches.map((c, i) => (
                <span
                  key={i}
                  style={{
                    width: 9,
                    height: 9,
                    borderRadius: "50%",
                    background: c,
                    boxShadow: "0 0 0 1px rgba(128,128,128,0.3)",
                  }}
                />
              ))}
            </span>
            {m.name}
          </button>
        );
      })}
    </div>
  );
}
