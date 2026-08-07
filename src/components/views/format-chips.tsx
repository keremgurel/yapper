"use client";

import { contentFormat } from "@/lib/content/formats";

/** What an item ships as, at a glance. Colour does the work here: a row is
 * meant to be readable in a scan down the column, not read word by word. */
export default function FormatChips({ formats }: { formats: string[] }) {
  if (!formats.length) return null;

  return (
    <span className="flex flex-wrap items-center gap-1">
      {formats.map((id) => {
        const format = contentFormat(id);
        if (!format) return null;
        return (
          <span
            key={id}
            className={`rounded px-1.5 py-0.5 text-[11px] font-bold ${format.chip}`}
          >
            {format.label}
          </span>
        );
      })}
    </span>
  );
}
