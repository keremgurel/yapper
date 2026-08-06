"use client";

import { useState } from "react";
import { ArrowLeftToLine, Layers, Loader2, Tag, Trash2, X } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usePillars } from "@/hooks/use-pillars";
import type { ContentStage, ContentStatus } from "@/lib/db/schema";
import { contentStatuses } from "@/lib/db/schema";

const STATUS_LABEL: Record<ContentStatus, string> = {
  drafted: "Drafted",
  planned: "Planned",
  scheduled: "Scheduled",
  posted: "Posted",
};

/**
 * The multi-select action bar, shared by both surfaces.
 *
 * Which actions appear is driven by the stage: the bank can send items to the
 * library, the library can send them back and set pipeline status. Everything
 * else (reclassify, delete, clear) is common to both.
 */
export default function BulkBar({
  stage,
  count,
  onSetPillar,
  onMove,
  onSetStatus,
  onDelete,
  onClear,
}: {
  stage: ContentStage;
  count: number;
  onSetPillar: (pillarId: string | null) => Promise<void>;
  onMove: (to: ContentStage) => Promise<void>;
  onSetStatus: (status: ContentStatus) => Promise<void>;
  onDelete: () => Promise<void>;
  onClear: () => void;
}) {
  const { pillars } = usePillars();
  const [busy, setBusy] = useState(false);

  if (count === 0) return null;

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    try {
      await action();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-x-0 bottom-6 z-40 flex justify-center px-4">
      <div className="sg-glass flex items-center gap-1 rounded-full px-3 py-2 shadow-2xl">
        <span className="text-foreground px-2 text-sm font-bold whitespace-nowrap">
          {count} selected
        </span>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              disabled={busy}
              className="text-muted-foreground hover:bg-muted hover:text-foreground flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-sm font-semibold transition-colors disabled:opacity-50"
            >
              <Tag className="h-4 w-4" />
              Pillar
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center" className="w-56">
            <DropdownMenuLabel>Move to pillar</DropdownMenuLabel>
            {pillars.length === 0 && (
              <DropdownMenuItem disabled>
                No pillars yet. Add them in Project.
              </DropdownMenuItem>
            )}
            {pillars.map((pillar) => (
              <DropdownMenuItem
                key={pillar.id}
                onSelect={() => void run(() => onSetPillar(pillar.id))}
              >
                {pillar.name}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => void run(() => onSetPillar(null))}
            >
              Clear pillar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {stage === "library" && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                disabled={busy}
                className="text-muted-foreground hover:bg-muted hover:text-foreground flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-sm font-semibold transition-colors disabled:opacity-50"
              >
                Status
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center">
              {contentStatuses
                // Scheduling needs a date per item, which a bulk action has no
                // sensible value for; the API refuses it for the same reason.
                .filter((status) => status !== "scheduled")
                .map((status) => (
                  <DropdownMenuItem
                    key={status}
                    onSelect={() => void run(() => onSetStatus(status))}
                  >
                    {STATUS_LABEL[status]}
                  </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        <button
          type="button"
          disabled={busy}
          onClick={() => void run(onDelete)}
          className="text-muted-foreground hover:bg-muted hover:text-destructive flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-sm font-semibold transition-colors disabled:opacity-50"
        >
          <Trash2 className="h-4 w-4" />
          Delete
        </button>

        {stage === "bank" ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void run(() => onMove("library"))}
            className="ml-1 flex items-center gap-1.5 rounded-full bg-[color:var(--sg-accent)] px-4 py-1.5 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Layers className="h-4 w-4" />
            )}
            Send to library
          </button>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() => void run(() => onMove("bank"))}
            className="text-muted-foreground hover:bg-muted hover:text-foreground ml-1 flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-sm font-semibold transition-colors disabled:opacity-50"
          >
            <ArrowLeftToLine className="h-4 w-4" />
            Back to bank
          </button>
        )}

        <button
          type="button"
          onClick={onClear}
          aria-label="Clear selection"
          className="text-muted-foreground hover:text-foreground ml-1 p-1.5"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
