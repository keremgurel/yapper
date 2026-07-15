"use client";

import { Card } from "@/components/ui/card";
import ContentRow from "@/components/library/content-row";
import SortHeader from "@/components/library/sort-header";
import { HEADER_GRID } from "@/components/library/content-table-layout";
import type { ContentSummary } from "@/lib/content/client";
import type { ContentStatus } from "@/lib/db/schema";
import type { ContentSort, ContentSortKey } from "@/lib/content/sort";

/** The library table: a sortable, Notion-style header over the pipeline rows.
 * Owns no state; the parent supplies the (already sorted) rows plus the sort
 * descriptor so the active column can render its arrow. */
export default function ContentTable({
  rows,
  sort,
  onToggleSort,
  onOpen,
  onStatus,
  onPost,
  freshId,
}: {
  rows: ContentSummary[];
  sort: ContentSort;
  onToggleSort: (key: ContentSortKey) => void;
  onOpen: (id: string) => void;
  onStatus: (row: ContentSummary, status: ContentStatus) => void;
  onPost: (row: ContentSummary) => void;
  freshId: string | null;
}) {
  const cell = (key: ContentSortKey, label: string) => (
    <SortHeader
      label={label}
      columnKey={key}
      active={sort.key === key}
      dir={sort.dir}
      onToggle={onToggleSort}
    />
  );

  return (
    <Card className="gap-0 overflow-hidden py-0">
      <div className={`${HEADER_GRID} bg-muted/40 border-b px-4 py-3`}>
        {cell("title", "Title")}
        {cell("status", "Status")}
        {cell("updated", "Updated")}
        <span />
      </div>
      {rows.length === 0 ? (
        <div className="text-muted-foreground px-4 py-8 text-center text-sm">
          No ideas in this pillar yet.
        </div>
      ) : (
        rows.map((row) => (
          <ContentRow
            key={row.id}
            row={row}
            fresh={freshId === row.id}
            onOpen={() => onOpen(row.id)}
            onStatus={(status) => onStatus(row, status)}
            onPost={() => onPost(row)}
          />
        ))
      )}
    </Card>
  );
}
