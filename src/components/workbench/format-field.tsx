"use client";

import { CONTENT_FORMATS } from "@/lib/content/formats";

/**
 * What this idea will ship as. Multi-select, because one angle routinely goes
 * out as a short and an article, and forcing a single choice would mean either
 * duplicating the item or losing half the plan.
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
        return (
          <button
            key={format.id}
            type="button"
            onClick={() => toggle(format.id)}
            aria-pressed={on}
            className={`rounded px-1.5 py-0.5 text-[11px] font-bold transition-colors ${
              on
                ? format.chip
                : "text-muted-foreground hover:text-foreground border-border border"
            }`}
          >
            {format.label}
          </button>
        );
      })}
    </div>
  );
}
