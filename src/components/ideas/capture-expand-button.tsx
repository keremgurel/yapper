"use client";

import { Maximize2, Minimize2 } from "lucide-react";

/** Grows the composer to the whole window, or brings it back. */
export default function CaptureExpandButton({
  expanded,
  onToggle,
}: {
  expanded: boolean;
  onToggle: () => void;
}) {
  const label = expanded ? "Back to the page" : "Write full screen";
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={label}
      aria-pressed={expanded}
      title={expanded ? `${label} (Esc)` : label}
      className="text-muted-foreground hover:bg-muted hover:text-foreground grid h-10 w-10 shrink-0 place-items-center rounded-full transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-[color:var(--sg-accent)] focus-visible:outline-none"
    >
      {expanded ? (
        <Minimize2 className="h-[18px] w-[18px]" />
      ) : (
        <Maximize2 className="h-[18px] w-[18px]" />
      )}
    </button>
  );
}
