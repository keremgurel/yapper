"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Chip, formatTone } from "@/components/studio-ui";
import { CONTENT_FORMATS, contentFormat } from "@/lib/content/formats";

/**
 * What this idea will ship as. Multi-select, because one angle routinely goes
 * out as a short and an article, and forcing a single choice would mean either
 * duplicating the item or losing half the plan.
 *
 * Only the chosen formats are shown; the rest live behind the plus. Rendering
 * all six outlined turned a field that usually holds one value into two rows of
 * noise, and the unselected ones read as if they were already set.
 */
export default function FormatField({
  formats,
  onChange,
}: {
  formats: string[];
  onChange: (formats: string[]) => void;
}) {
  const [open, setOpen] = useState(false);

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
    <div className="flex flex-wrap items-center justify-end gap-1">
      {formats.map((id) => {
        const format = contentFormat(id);
        if (!format) return null;
        return (
          <button
            key={id}
            type="button"
            onClick={() => toggle(id)}
            title={`Remove ${format.label}`}
            className="rounded-full transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-[color:var(--sg-accent)] focus-visible:outline-none"
          >
            <Chip
              tone={formatTone(id)}
              pill
              className="h-7 px-3 text-[12px] font-medium"
            >
              {format.label}
            </Chip>
          </button>
        );
      })}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="Add a format"
        className="bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/70 inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-[12px] font-medium transition-colors focus-visible:ring-2 focus-visible:ring-[color:var(--sg-accent)] focus-visible:outline-none"
      >
        <Plus className="h-3.5 w-3.5" />
        {formats.length === 0 ? "Format" : null}
      </button>

      {open && (
        <div className="border-border bg-popover mt-1 flex w-full flex-wrap justify-end gap-1 rounded-lg border p-2">
          {CONTENT_FORMATS.filter((f) => !formats.includes(f.id)).map(
            (format) => (
              <button
                key={format.id}
                type="button"
                onClick={() => {
                  toggle(format.id);
                  setOpen(false);
                }}
                className="text-muted-foreground hover:text-foreground border-border rounded-md border px-2 py-0.5 text-[11px] font-semibold transition-colors"
              >
                {format.label}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
}
