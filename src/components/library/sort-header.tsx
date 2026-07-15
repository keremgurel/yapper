"use client";

import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import type { ContentSortKey, SortDir } from "@/lib/content/sort";

/** One clickable column heading. Shows a solid arrow when its column drives the
 * sort, and a faint hint arrow on hover otherwise, so any column reads as
 * sortable the way a Notion database does. Render-only: the parent owns the
 * sort state and decides what a click means. */
export default function SortHeader({
  label,
  columnKey,
  active,
  dir,
  onToggle,
  className = "",
}: {
  label: string;
  columnKey: ContentSortKey;
  active: boolean;
  dir: SortDir;
  onToggle: (key: ContentSortKey) => void;
  className?: string;
}) {
  const Arrow = active ? (dir === "asc" ? ArrowUp : ArrowDown) : ChevronsUpDown;
  return (
    <button
      type="button"
      onClick={() => onToggle(columnKey)}
      aria-label={`Sort by ${label}`}
      className={`group flex items-center gap-1 text-[11px] font-bold tracking-wider uppercase transition-colors ${
        active
          ? "text-foreground"
          : "text-muted-foreground hover:text-foreground"
      } ${className}`}
    >
      <span className="font-display">{label}</span>
      <Arrow
        className={`h-3 w-3 shrink-0 transition-opacity ${
          active ? "opacity-100" : "opacity-0 group-hover:opacity-60"
        }`}
      />
    </button>
  );
}
