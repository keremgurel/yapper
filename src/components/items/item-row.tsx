"use client";

import { Check } from "lucide-react";
import ItemCell from "@/components/items/item-cell";
import type { ColumnKey } from "@/lib/content/columns";
import type { ContentSummary } from "@/lib/content/client";
import type { ContentStatus } from "@/lib/db/schema";

/**
 * One row of the shared item table.
 *
 * Not a `<button>`: the status control inside is itself a button, and
 * button-in-button is invalid HTML. A div with button semantics keeps the row
 * clickable and keyboardable without nesting interactive elements.
 */
export default function ItemRow({
  row,
  columns,
  selected,
  onToggleSelect,
  onOpen,
  onStatus,
  onPost,
}: {
  row: ContentSummary;
  columns: ColumnKey[];
  selected: boolean;
  onToggleSelect: () => void;
  onOpen: () => void;
  onStatus: (status: ContentStatus) => void;
  onPost: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Open ${row.title.trim() || "untitled idea"}`}
      title="Open workspace"
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      className={`grid min-h-13 cursor-pointer items-center gap-3 border-b px-4 py-2 text-left transition-colors outline-none last:border-b-0 focus-visible:ring-2 focus-visible:ring-[color:var(--sg-accent)]/60 focus-visible:ring-inset ${
        selected ? "bg-[color:var(--sg-accent)]/8" : "hover:bg-muted/40"
      }`}
      style={{ gridTemplateColumns: "var(--item-grid)" }}
    >
      <span
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onToggleSelect}
          aria-label={selected ? "Deselect" : "Select"}
          aria-pressed={selected}
          className={`flex h-[18px] w-[18px] items-center justify-center rounded-[5px] border transition-colors ${
            selected
              ? "border-[color:var(--sg-accent)] bg-[color:var(--sg-accent)] text-white"
              : "border-border hover:border-foreground/40"
          }`}
        >
          {selected && <Check className="h-3 w-3" />}
        </button>
      </span>

      {columns.map((key) => (
        <span
          key={key}
          className="flex min-w-0 items-center"
          // The status control is interactive; a click on it must not also
          // open the row.
          onClick={key === "status" ? (e) => e.stopPropagation() : undefined}
        >
          <ItemCell
            column={key}
            row={row}
            onStatus={onStatus}
            onPost={onPost}
          />
        </span>
      ))}
    </div>
  );
}
