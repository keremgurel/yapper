"use client";

import { useState } from "react";
import PlatformIcon from "@/components/publish/platform-icon";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { PLATFORMS } from "@/lib/publish/platforms";
import type { ScheduleSummary } from "@/lib/publish/schedule-types";
import ScheduleDetails from "./schedule-details";
import { SCHEDULE_STATUS } from "./schedule-status";

/** The drag payload type for a scheduled post, kept apart from planned items
 * (`text/plain`) so each drop goes to the right save. */
export const SCHEDULE_DRAG_TYPE = "application/x-yapper-schedule";

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * A post that will send itself: platform, time and title on its status tint.
 * Click for details and actions; drag to another day while it is still
 * waiting to send.
 */
export default function CalendarScheduleChip({
  row,
  onSaved,
}: {
  row: ScheduleSummary;
  onSaved: (row: ScheduleSummary) => void;
}) {
  const [open, setOpen] = useState(false);
  const status = SCHEDULE_STATUS[row.status];
  const draggable = row.status === "scheduled";
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          draggable={draggable}
          onDragStart={(event) => {
            event.dataTransfer.setData(SCHEDULE_DRAG_TYPE, row.id);
            event.dataTransfer.effectAllowed = "move";
          }}
          aria-label={`${row.title}, ${PLATFORMS[row.platform].label} at ${timeLabel(row.scheduledFor)}, ${status.label}`}
          className={`flex w-full min-w-0 items-center justify-center gap-1.5 overflow-hidden rounded-md px-1 py-1 text-left transition-[filter] hover:brightness-95 focus-visible:ring-2 focus-visible:ring-[color:var(--sg-accent)] focus-visible:outline-none sm:justify-start sm:px-1.5 ${draggable ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"} ${status.chip}`}
        >
          <span className="bg-background ring-foreground/15 grid size-4 shrink-0 place-items-center rounded-full ring-1">
            <PlatformIcon
              platform={row.platform}
              branded
              className="size-2.5"
            />
          </span>
          {/* A phone's month cell fits only the platform; the popover has the rest. */}
          <span className="hidden shrink-0 text-[11px] font-bold tabular-nums opacity-70 sm:inline">
            {timeLabel(row.scheduledFor)}
          </span>
          <span className="hidden truncate text-[11px] font-bold sm:inline">
            {row.title}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80">
        <ScheduleDetails
          row={row}
          onSaved={(saved) => {
            onSaved(saved);
            if (saved.status === "cancelled") setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
