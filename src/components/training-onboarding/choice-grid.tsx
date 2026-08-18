"use client";

import { Check } from "lucide-react";

import type { OnboardingChoice } from "@/data/training-onboarding";

/**
 * A multi-select list of onboarding options. Selection is the one thing on
 * screen that earns the accent color, which is why the chosen state is the
 * only thing tinted.
 */
export default function ChoiceGrid({
  options,
  selected,
  onToggle,
  label,
}: {
  options: OnboardingChoice[];
  selected: string[];
  onToggle: (id: string) => void;
  label: string;
}) {
  return (
    <div role="group" aria-label={label} className="grid gap-2 sm:grid-cols-2">
      {options.map((option) => {
        const isSelected = selected.includes(option.id);
        return (
          <button
            key={option.id}
            type="button"
            role="checkbox"
            aria-checked={isSelected}
            onClick={() => onToggle(option.id)}
            className={`flex items-center justify-between gap-2 rounded-xl border px-3.5 py-3 text-left text-[13px] font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-[color:var(--sg-accent)] focus-visible:outline-none ${
              isSelected
                ? "text-foreground border-[color:var(--sg-accent)] bg-[color:var(--sg-accent)]/10"
                : "border-border bg-card text-foreground/80 hover:bg-muted"
            }`}
          >
            <span className="min-w-0 truncate">{option.label}</span>
            {isSelected && (
              <Check
                className="h-4 w-4 shrink-0 text-[color:var(--sg-accent)]"
                aria-hidden
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
