"use client";

import type { ContentSummary } from "@/lib/content/client";
import {
  dayKey,
  isSameMonth,
  monthWeeks,
  sameDay,
} from "@/lib/content/calendar";
import CalendarDayCell from "./calendar-day-cell";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** The month grid: a weekday header and 7-wide rows of day cells. */
export default function MonthView({
  focus,
  byDay,
  today,
  onOpenItem,
  onDropDay,
}: {
  focus: Date;
  byDay: Map<string, ContentSummary[]>;
  today: Date;
  onOpenItem: (id: string) => void;
  onDropDay: (id: string, day: Date) => void;
}) {
  const days = monthWeeks(focus).flat();

  return (
    <div className="border-border overflow-hidden rounded-xl border">
      <div className="bg-muted/40 grid grid-cols-7 border-b">
        {WEEKDAYS.map((d) => (
          <div
            key={d}
            className="text-muted-foreground px-2 py-2 text-[11px] font-black"
          >
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day) => (
          <CalendarDayCell
            key={dayKey(day)}
            day={day}
            items={byDay.get(dayKey(day)) ?? []}
            inMonth={isSameMonth(day, focus)}
            isToday={sameDay(day, today)}
            dense
            onOpenItem={onOpenItem}
            onDropDay={onDropDay}
          />
        ))}
      </div>
    </div>
  );
}
