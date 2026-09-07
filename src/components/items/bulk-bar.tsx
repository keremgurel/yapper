"use client";

import { DeleteButton } from "@/components/ui/delete-button";
import { useRef, useState } from "react";
import { Tag, X } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usePillars } from "@/hooks/use-pillars";
import type { ContentStatus } from "@/lib/db/schema";
import { contentStatuses } from "@/lib/db/schema";

const STATUS_LABEL: Record<ContentStatus, string> = {
  captured: "Captured",
  drafting: "Drafting",
  ready: "Ready",
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
  count,
  onSetPillar,
  onSetStatus,
  onDelete,
  onClear,
}: {
  count: number;
  onSetPillar: (pillarId: string | null) => Promise<void>;
  onSetStatus: (status: ContentStatus) => Promise<void>;
  onDelete: () => Promise<void>;
  onClear: () => void;
}) {
  const { pillars } = usePillars();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const running = useRef(false);

  if (count === 0) return null;

  const run = async (action: () => Promise<void>) => {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setError(false);
    try {
      await action();
    } catch {
      setError(true);
    } finally {
      running.current = false;
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-x-0 bottom-6 z-40 flex justify-center px-4">
      {error && (
        <p
          role="alert"
          className="bg-card text-destructive absolute bottom-full mb-2 rounded-lg border px-4 py-2 text-sm"
        >
          The change couldn’t be confirmed. Your selection is kept; check the
          items and try again.
        </p>
      )}
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
            {contentStatuses.map((status) => (
              <DropdownMenuItem
                key={status}
                onSelect={() => void run(() => onSetStatus(status))}
              >
                {STATUS_LABEL[status]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <DeleteButton
          size="sm"
          label="Delete selected"
          disabled={busy}
          onConfirm={() => void run(onDelete)}
        />
        <button
          type="button"
          onClick={onClear}
          disabled={busy}
          aria-label="Clear selection"
          className="text-muted-foreground hover:text-foreground ml-1 p-1.5"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
