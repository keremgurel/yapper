"use client";

import { FileText } from "lucide-react";
import { Chip, pillarTone } from "@/components/studio-ui";
import FormatChips from "@/components/views/format-chips";
import { scriptMeter } from "@/lib/content/script-meter";
import type { ContentSummary } from "@/lib/content/client";

/** One item as a board card: what it is, what it ships as, and whether it is
 * ready to shoot. Deliberately not the whole row, because a board is for
 * deciding what to work on next, and the table is there when you need every
 * field. */
export default function BoardCard({
  row,
  onOpen,
  draggable,
  onDragStart,
  onDragEnd,
}: {
  row: ContentSummary;
  onOpen: () => void;
  draggable: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const meter = scriptMeter(row.script);

  return (
    <button
      type="button"
      onClick={onOpen}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={`border-border bg-card hover:border-foreground/25 w-full rounded-lg border p-3 text-left transition-colors focus-visible:ring-2 focus-visible:ring-[color:var(--sg-accent)] focus-visible:outline-none ${
        draggable ? "cursor-grab active:cursor-grabbing" : ""
      }`}
    >
      <p className="text-foreground line-clamp-2 text-[13px] font-semibold">
        {row.title || "Untitled"}
      </p>

      {(row.pillar || row.formats.length > 0) && (
        <span className="mt-2 flex flex-wrap items-center gap-1">
          {row.pillar && (
            <Chip tone={pillarTone(row.pillar)} variant="dot">
              {row.pillar}
            </Chip>
          )}
          <FormatChips formats={row.formats} />
        </span>
      )}

      {meter.words > 0 && (
        <span className="text-muted-foreground mt-2 flex items-center gap-1 font-mono text-[11px] tabular-nums">
          <FileText aria-hidden className="h-3 w-3" />~{meter.label}
        </span>
      )}
    </button>
  );
}
