"use client";

/**
 * CollapseToggle — the FAQ +/× toggle you like: a plus that rotates 45° into an
 * ×, and flips to a filled chip when open. Tokenized from the real home-faq
 * button. Presentational: parent owns `open`.
 */
export function CollapseToggle({ open }: { open: boolean }) {
  return (
    <span
      aria-hidden
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 24,
        height: 24,
        borderRadius: "var(--sg-radius-xs)",
        transition: "transform 200ms var(--sg-ease-out), background 200ms ease",
        transform: open ? "rotate(45deg)" : "rotate(0deg)",
        background: open ? "var(--sg-text)" : "var(--sg-surface-sunken)",
        border: open ? "none" : "1px solid var(--sg-border)",
      }}
    >
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
        <path
          d="M6 1V11M1 6H11"
          stroke={open ? "var(--sg-surface)" : "var(--sg-text-muted)"}
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}
