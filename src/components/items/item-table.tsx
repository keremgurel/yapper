"use client";

import { Check, Minus } from "lucide-react";
import ItemRow from "@/components/items/item-row";
import SortHeader from "@/components/library/sort-header";
import { Card } from "@/components/ui/card";
import { useIsMobile } from "@/hooks/use-mobile";
import { columnDef, gridTemplate, type ColumnKey } from "@/lib/content/columns";
import type { ContentSummary } from "@/lib/content/client";
import type { ContentSort, ContentSortKey } from "@/lib/content/sort";
import type { ContentStatus } from "@/lib/db/schema";

/**
 * The one table both the Idea Bank and the Content Library render.
 *
 * The surfaces differ only in which columns are on and which rows are passed
 * in; everything else (selection, sorting, the row chrome) is shared, which is
 * what keeps the two from drifting apart the way they had.
 *
 * Column visibility is resolved in JS rather than with `hidden sm:flex`,
 * because the grid track list has to match the cells that actually render.
 * Hiding a cell with CSS would leave its track behind and shift every column
 * after it into the wrong width.
 */
export default function ItemTable({
  rows,
  columns,
  sort,
  onToggleSort,
  selectedIds,
  onToggleSelect,
  onSelectAll,
  onOpen,
  onStatus,
  onPost,
  emptyLabel,
}: {
  rows: ContentSummary[];
  columns: ColumnKey[];
  sort: ContentSort;
  onToggleSort: (key: ContentSortKey) => void;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onSelectAll: (ids: string[]) => void;
  onOpen: (id: string) => void;
  onStatus: (row: ContentSummary, status: ContentStatus) => void;
  onPost: (row: ContentSummary) => void;
  emptyLabel: string;
}) {
  const mobile = useIsMobile();
  const visible = mobile
    ? columns.filter((key) => columnDef(key).compact)
    : columns;
  const grid = gridTemplate(visible, false);

  const allSelected =
    rows.length > 0 && rows.every((r) => selectedIds.has(r.id));
  const someSelected = rows.some((r) => selectedIds.has(r.id));

  return (
    <Card
      className="gap-0 overflow-hidden py-0"
      style={{ ["--item-grid" as string]: grid }}
    >
      <div
        className="bg-muted/40 grid items-center gap-3 border-b px-4 py-2.5"
        style={{ gridTemplateColumns: grid }}
      >
        <button
          type="button"
          onClick={() => onSelectAll(allSelected ? [] : rows.map((r) => r.id))}
          aria-label={allSelected ? "Deselect all" : "Select all"}
          aria-pressed={allSelected}
          disabled={rows.length === 0}
          className={`flex h-[18px] w-[18px] items-center justify-center rounded-[5px] border transition-colors disabled:opacity-40 ${
            allSelected || someSelected
              ? "border-[color:var(--sg-accent)] bg-[color:var(--sg-accent)] text-white"
              : "border-border hover:border-foreground/40"
          }`}
        >
          {allSelected ? (
            <Check className="h-3 w-3" />
          ) : someSelected ? (
            <Minus className="h-3 w-3" />
          ) : null}
        </button>

        {visible.map((key) => {
          const def = columnDef(key);
          return def.sortable ? (
            <SortHeader
              key={key}
              label={def.label}
              columnKey={key as ContentSortKey}
              active={sort.key === key}
              dir={sort.dir}
              onToggle={onToggleSort}
            />
          ) : (
            <span
              key={key}
              className="text-muted-foreground truncate text-xs font-semibold"
            >
              {def.label}
            </span>
          );
        })}
      </div>

      {rows.length === 0 ? (
        <div className="text-muted-foreground px-4 py-10 text-center text-sm">
          {emptyLabel}
        </div>
      ) : (
        rows.map((row) => (
          <ItemRow
            key={row.id}
            row={row}
            columns={visible}
            selected={selectedIds.has(row.id)}
            onToggleSelect={() => onToggleSelect(row.id)}
            onOpen={() => onOpen(row.id)}
            onStatus={(status) => onStatus(row, status)}
            onPost={() => onPost(row)}
          />
        ))
      )}
    </Card>
  );
}
