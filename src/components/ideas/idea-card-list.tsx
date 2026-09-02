"use client";

import IdeaCard from "@/components/ideas/idea-card";
import type { ItemSummary } from "@/lib/ideas/client";

/**
 * The card view of the bank: one readable card per idea, expandable in place.
 * Selection and per-row work state stay with the parent so the table and card
 * views can never disagree about what is selected or in flight.
 */
export default function IdeaCardList({
  rows,
  selectedIds,
  working,
  analysisErrors,
  onToggleSelect,
  onRetry,
}: {
  rows: ItemSummary[];
  selectedIds: Set<string>;
  working: Set<string>;
  analysisErrors: Set<string>;
  onToggleSelect: (id: string) => void;
  onRetry: (id: string) => void;
}) {
  if (rows.length === 0) {
    return (
      <p className="text-muted-foreground py-10 text-center text-sm">
        Nothing matches those filters.
      </p>
    );
  }

  return (
    <div className="grid gap-3 xl:grid-cols-2">
      {rows.map((row) => (
        <IdeaCard
          key={row.id}
          item={row}
          selected={selectedIds.has(row.id)}
          working={working.has(row.id)}
          analysisFailed={analysisErrors.has(row.id)}
          onToggle={() => onToggleSelect(row.id)}
          onRetry={() => onRetry(row.id)}
        />
      ))}
    </div>
  );
}
