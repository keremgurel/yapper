"use client";

import { CHIP_TONES, formatTone } from "@/components/studio-ui";
import { CONTENT_FORMATS } from "@/lib/content/formats";

/**
 * What this idea will ship as. Every format is a toggle, so the choice is
 * one tap and the whole set is visible: one angle routinely goes out as a
 * short and an article, and a hidden menu made that a two-step guess.
 */
export default function FormatField({
  formats,
  onChange,
}: {
  formats: string[];
  onChange: (formats: string[]) => void;
}) {
  const toggle = (id: string) =>
    onChange(
      formats.includes(id)
        ? formats.filter((f) => f !== id)
        : // Library order, so two items with the same formats always read the
          // same way round in the table.
          CONTENT_FORMATS.filter(
            (f) => f.id === id || formats.includes(f.id),
          ).map((f) => f.id),
    );

  return (
    <div className="flex flex-wrap gap-1.5">
      {CONTENT_FORMATS.map((format) => {
        const on = formats.includes(format.id);
        const tone = CHIP_TONES[formatTone(format.id)];
        return (
          <button
            key={format.id}
            type="button"
            aria-pressed={on}
            onClick={() => toggle(format.id)}
            className={`h-7 rounded-full px-3 text-[12px] font-medium transition-colors focus-visible:ring-2 focus-visible:ring-[color:var(--sg-accent)] focus-visible:outline-none ${
              on
                ? `${tone.bg} ${tone.fg}`
                : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            {format.label}
          </button>
        );
      })}
    </div>
  );
}
