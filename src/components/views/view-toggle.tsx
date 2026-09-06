"use client";

import { Check } from "lucide-react";

/**
 * A neutral on/off chip for view options (layout, grouping). Deliberately not
 * accent-colored: orange is reserved for the page's primary action and
 * selection of content, and a settings popover full of orange toggles read as
 * a wall of primary buttons.
 */
export default function ViewToggle({
  on,
  label,
  onClick,
}: {
  on: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-[color:var(--sg-accent)] focus-visible:outline-none ${
        on
          ? "border-foreground/30 bg-muted text-foreground"
          : "border-border text-muted-foreground hover:text-foreground"
      }`}
    >
      {on && <Check aria-hidden className="h-3 w-3" />}
      {label}
    </button>
  );
}
