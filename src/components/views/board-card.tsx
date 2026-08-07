"use client";

import { FileText } from "lucide-react";
import FormatChips from "@/components/views/format-chips";
import { scriptMeter } from "@/lib/content/script-meter";
import type { ContentSummary } from "@/lib/content/client";

/** One item as a board card: what it is, what it ships as, and whether it is
 * ready to shoot. Deliberately not the whole row — a board is for deciding what
 * to work on next, and the table is there when you need every field. */
export default function BoardCard({
  row,
  onOpen,
  draggable,
  onDragStart,
}: {
  row: ContentSummary;
  onOpen: () => void;
  draggable: boolean;
  onDragStart: () => void;
}) {
  const meter = scriptMeter(row.script);

  return (
    <button
      type="button"
      onClick={onOpen}
      draggable={draggable}
      onDragStart={onDragStart}
      className="border-border bg-card hover:border-foreground/25 w-full rounded-lg border p-3 text-left transition-colors"
    >
      <p className="text-foreground line-clamp-2 text-[13px] font-bold">
        {row.title || "Untitled"}
      </p>

      {(row.pillar || row.formats.length) && (
        <span className="mt-1.5 flex flex-wrap items-center gap-1">
          {row.pillar && (
            <span className="truncate rounded bg-[color:var(--sg-accent)]/15 px-1.5 py-0.5 text-[11px] font-bold text-[color:var(--sg-accent)]">
              {row.pillar}
            </span>
          )}
          <FormatChips formats={row.formats} />
        </span>
      )}

      {meter.words > 0 && (
        <span className="text-muted-foreground mt-1.5 flex items-center gap-1 text-[11px] font-semibold">
          <FileText className="h-3 w-3" />~{meter.label}
        </span>
      )}
    </button>
  );
}
