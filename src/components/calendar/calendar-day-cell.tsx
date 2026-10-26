"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import type { ContentSummary } from "@/lib/content/client";
import type { PostedGroup } from "@/lib/content/posted-days";
import type { ScheduleSummary } from "@/lib/publish/schedule-types";
import CalendarPostChip from "./calendar-post-chip";
import CalendarPostedList from "./calendar-posted-list";
import CalendarScheduleChip, {
  SCHEDULE_DRAG_TYPE,
} from "./calendar-schedule-chip";

/** What the grid needs to show and move scheduled posts. */
export interface ScheduleLayer {
  byDay: Map<string, ScheduleSummary[]>;
  onDrop: (id: string, day: Date) => void;
  onSaved: (row: ScheduleSummary) => void;
}

/** A single day in the grid: its date, the posts that will send themselves,
 * the planned items, what already went out, and a drop target for both kinds
 * of drag. `dense` (month view) caps the visible chips; `showDate` is off in
 * week view, where the column header carries the date. `addHref` opens Poster
 * ready to schedule on this day; null for days already past. */
export default function CalendarDayCell({
  day,
  items,
  schedules,
  posted,
  inMonth,
  isToday,
  dense,
  showDate = true,
  addHref,
  layer,
  onOpenItem,
  onDropDay,
}: {
  day: Date;
  items: ContentSummary[];
  schedules: ScheduleSummary[];
  posted: PostedGroup[];
  inMonth: boolean;
  isToday: boolean;
  dense: boolean;
  showDate?: boolean;
  addHref: string | null;
  layer: ScheduleLayer;
  onOpenItem: (id: string) => void;
  onDropDay: (id: string, day: Date) => void;
}) {
  const [over, setOver] = useState(false);
  const cap = dense ? 3 : Infinity;
  const shownSchedules = schedules.slice(0, cap);
  const shownItems = items.slice(0, Math.max(0, cap - shownSchedules.length));
  const extra =
    schedules.length + items.length - shownSchedules.length - shownItems.length;
  const label = day.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const scheduleId = e.dataTransfer.getData(SCHEDULE_DRAG_TYPE);
        if (scheduleId) return layer.onDrop(scheduleId, day);
        const id = e.dataTransfer.getData("text/plain");
        if (id) onDropDay(id, day);
      }}
      className={`group flex min-w-0 flex-col gap-1 border-r border-b p-1.5 ${
        dense ? "min-h-24" : "min-h-[26rem]"
      } ${inMonth ? "" : "bg-muted/20"} ${
        over ? "ring-2 ring-[color:var(--sg-accent)] ring-inset" : ""
      }`}
    >
      <div className="flex h-5 items-center justify-between">
        {showDate ? (
          <span
            className={
              isToday
                ? "flex h-5 w-5 items-center justify-center rounded-full bg-[color:var(--sg-accent)] text-[11px] font-black text-white"
                : `text-[11px] font-bold ${
                    inMonth ? "text-foreground" : "text-muted-foreground/50"
                  }`
            }
          >
            {day.getDate()}
          </span>
        ) : (
          <span />
        )}
        {addHref && (
          <Link
            href={addHref}
            aria-label={`Schedule a post on ${label}`}
            title="Schedule a post on this day"
            className="text-muted-foreground hover:text-foreground hover:bg-muted grid size-5 place-items-center rounded-md opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-[color:var(--sg-accent)] focus-visible:outline-none [@media(hover:none)]:size-6 [@media(hover:none)]:opacity-100"
          >
            <Plus className="size-3.5" />
          </Link>
        )}
      </div>
      <div className="flex flex-col gap-1">
        {shownSchedules.map((row) => (
          <CalendarScheduleChip
            key={row.id}
            row={row}
            onSaved={layer.onSaved}
          />
        ))}
        {shownItems.map((it) => (
          <CalendarPostChip
            key={it.id}
            item={it}
            onOpen={() => onOpenItem(it.id)}
          />
        ))}
        {extra > 0 && (
          <span className="text-muted-foreground px-1 text-[11px] font-bold">
            +{extra} more
          </span>
        )}
      </div>
      <CalendarPostedList groups={posted} dense={dense} />
    </div>
  );
}
