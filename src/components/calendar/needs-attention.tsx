"use client";

import PlatformIcon from "@/components/publish/platform-icon";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { scheduleRowErrorMessage } from "@/lib/publish/schedule-client";
import type { ScheduleSummary } from "@/lib/publish/schedule-types";
import ScheduleDetails from "./schedule-details";
import { needsAttention } from "./schedule-status";

/**
 * Scheduled posts that did not go out and are waiting on the creator, above
 * the grid so they are not lost in a past week. Also says plainly when the
 * scheduler is off, since then nothing on the grid will send.
 */
export default function NeedsAttention({
  schedules,
  enabled,
  onSaved,
}: {
  schedules: ScheduleSummary[];
  enabled: boolean;
  onSaved: (row: ScheduleSummary) => void;
}) {
  const rows = schedules.filter((row) => needsAttention(row.status));
  const waiting = schedules.some((row) => row.status === "scheduled");
  if (!rows.length && (enabled || !waiting)) return null;
  return (
    <section aria-label="Posts that need you" className="mb-6 space-y-3">
      {!enabled && waiting && (
        <p role="status" className="text-muted-foreground text-sm">
          Scheduled publishing is paused, so these posts won’t send on their own
          yet. You can still cancel any of them.
        </p>
      )}
      {rows.length > 0 && (
        <ul className="bg-card divide-border/60 divide-y rounded-xl border">
          {rows.map((row) => (
            <li
              key={row.id}
              className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3"
            >
              <PlatformIcon
                platform={row.platform}
                branded
                className="size-4 shrink-0"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{row.title}</p>
                <p className="text-destructive truncate text-xs">
                  {scheduleRowErrorMessage(row)}
                </p>
              </div>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm">
                    {row.status === "failed" ? "Fix" : "Review"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-80">
                  <ScheduleDetails row={row} onSaved={onSaved} />
                </PopoverContent>
              </Popover>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
