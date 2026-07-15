"use client";

import { useState } from "react";
import type { ContentSummary } from "@/lib/content/client";
import CalendarPostChip from "./calendar-post-chip";

/** A single day in the grid: its date, the posts scheduled on it, and a drop
 * target for drag-to-reschedule. `dense` (month view) caps the visible chips;
 * `showDate` is off in week view, where the column header carries the date. */
export default function CalendarDayCell({
  day,
  items,
  inMonth,
  isToday,
  dense,
  showDate = true,
  onOpenItem,
  onDropDay,
}: {
  day: Date;
  items: ContentSummary[];
  inMonth: boolean;
  isToday: boolean;
  dense: boolean;
  showDate?: boolean;
  onOpenItem: (id: string) => void;
  onDropDay: (id: string, day: Date) => void;
}) {
  const [over, setOver] = useState(false);
  const cap = dense ? 3 : items.length;
  const shown = items.slice(0, cap);
  const extra = items.length - shown.length;

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
        const id = e.dataTransfer.getData("text/plain");
        if (id) onDropDay(id, day);
      }}
      className={`flex flex-col gap-1 border-r border-b p-1.5 ${
        dense ? "min-h-24" : "min-h-[26rem]"
      } ${inMonth ? "" : "bg-muted/20"} ${
        over ? "ring-2 ring-[color:var(--sg-accent)] ring-inset" : ""
      }`}
    >
      {showDate && (
        <div className="flex items-center justify-between">
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
        </div>
      )}
      <div className="flex flex-col gap-1">
        {shown.map((it) => (
          <CalendarPostChip
            key={it.id}
            item={it}
            onOpen={() => onOpenItem(it.id)}
          />
        ))}
        {extra > 0 && (
          <span className="text-muted-foreground px-1 text-[10px] font-bold">
            +{extra} more
          </span>
        )}
      </div>
    </div>
  );
}
