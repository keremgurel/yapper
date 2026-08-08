"use client";

import { Check } from "lucide-react";
import { CHIP_TONES, type ChipTone } from "@/components/studio-ui";

export interface FilterChipOption {
  id: string;
  label: string;
  tone: ChipTone;
}

/**
 * A multi-select row of toned chips for a view filter. When a chip is on it
 * wears the same tint the value wears in the table, so the filter teaches the
 * color mapping instead of adding a second vocabulary.
 */
export default function ViewFilterChips({
  options,
  selected,
  onToggle,
  groupLabel,
}: {
  options: FilterChipOption[];
  selected: string[];
  onToggle: (id: string) => void;
  groupLabel: string;
}) {
  return (
    <div
      role="group"
      aria-label={groupLabel}
      className="flex flex-wrap gap-1.5"
    >
      {options.map((option) => {
        const on = selected.includes(option.id);
        const t = CHIP_TONES[option.tone];
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onToggle(option.id)}
            aria-pressed={on}
            className={`flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-[color:var(--sg-accent)] focus-visible:outline-none ${
              on
                ? `${t.bg} ${t.fg}`
                : "border-border text-muted-foreground hover:text-foreground border"
            }`}
          >
            {on && <Check aria-hidden className="h-3 w-3" />}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
