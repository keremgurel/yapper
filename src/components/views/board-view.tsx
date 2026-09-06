"use client";

import { useState } from "react";
import { CHIP_TONES, EmptyState, statusTone } from "@/components/studio-ui";
import BoardCard from "@/components/views/board-card";
import { groupItems } from "@/lib/content/group-items";
import type { ContentSummary } from "@/lib/content/client";
import type { ContentStatus, LibraryGrouping } from "@/lib/db/schema";
import { contentStatuses } from "@/lib/db/schema";

/**
 * The pipeline as columns.
 *
 * Dragging is offered only when grouping by status, because that is the one
 * axis where moving a card means something unambiguous: advance it. Dropping a
 * card into a different pillar would silently reclassify it, and dropping into
 * a format group is meaningless when an item can hold several formats at once.
 */
export default function BoardView({
  rows,
  groupBy,
  onOpen,
  onStatusChange,
}: {
  rows: ContentSummary[];
  groupBy: LibraryGrouping | null;
  onOpen: (id: string) => void;
  onStatusChange: (row: ContentSummary, status: ContentStatus) => void;
}) {
  const [dragging, setDragging] = useState<ContentSummary | null>(null);
  const [over, setOver] = useState<string | null>(null);

  const groups = groupItems(rows, groupBy ?? "status");
  const canDrag = (groupBy ?? "status") === "status";

  const isStatus = (key: string): key is ContentStatus =>
    (contentStatuses as readonly string[]).includes(key);

  return (
    <div className="flex gap-3 overflow-x-auto pb-4">
      {groups.map((group) => {
        const active = over === group.key && canDrag;
        return (
          <section
            key={group.key}
            aria-label={group.label}
            onDragOver={(e) => {
              if (!canDrag || !dragging) return;
              // Required for the drop to fire at all.
              e.preventDefault();
              setOver(group.key);
            }}
            onDragLeave={() => setOver((k) => (k === group.key ? null : k))}
            onDrop={() => {
              setOver(null);
              if (!canDrag || !dragging || !isStatus(group.key)) return;
              if (dragging.status !== group.key) {
                onStatusChange(dragging, group.key);
              }
              setDragging(null);
            }}
            className={`bg-muted w-[264px] shrink-0 rounded-xl p-2 transition-shadow ${
              active
                ? "ring-2 ring-[color:var(--sg-accent)] ring-inset"
                : "ring-0"
            }`}
          >
            <header className="mb-2 flex items-center gap-2 px-1.5 pt-1">
              {isStatus(group.key) && (
                <span
                  aria-hidden
                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${CHIP_TONES[statusTone(group.key)].dot}`}
                />
              )}
              <h2 className="text-muted-foreground text-[11px] font-bold tracking-[0.1em] uppercase">
                {group.label}
              </h2>
              <span className="text-muted-foreground font-mono text-[11px] tabular-nums">
                {group.items.length}
              </span>
            </header>

            <div className="space-y-2">
              {group.items.map((row) => (
                <BoardCard
                  key={row.id}
                  row={row}
                  onOpen={() => onOpen(row.id)}
                  draggable={canDrag}
                  onDragStart={() => setDragging(row)}
                  onDragEnd={() => {
                    setDragging(null);
                    setOver(null);
                  }}
                />
              ))}
              {!group.items.length && (
                <EmptyState
                  title="Nothing here"
                  description={
                    canDrag ? "Drag a card here to move it." : undefined
                  }
                />
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
