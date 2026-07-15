"use client";

import type { ContentSummary } from "@/lib/content/client";
import { dayKey, sameDay, weekDays } from "@/lib/content/calendar";
import CalendarDayCell from "./calendar-day-cell";

/** The week grid: 7 tall day columns, each with its own dated header. */
export default function WeekView({
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
  return (
    <div className="border-border grid grid-cols-7 overflow-hidden rounded-xl border">
      {weekDays(focus).map((day) => {
        const isToday = sameDay(day, today);
        return (
          <div key={dayKey(day)} className="flex flex-col">
            <div className="bg-muted/40 border-b px-2 py-2 text-center">
              <div className="text-muted-foreground text-[10px] font-black uppercase">
                {day.toLocaleDateString(undefined, { weekday: "short" })}
              </div>
              <div
                className={`text-sm font-black ${
                  isToday ? "text-[color:var(--sg-accent)]" : "text-foreground"
                }`}
              >
                {day.getDate()}
              </div>
            </div>
            <CalendarDayCell
              day={day}
              items={byDay.get(dayKey(day)) ?? []}
              inMonth
              isToday={isToday}
              dense={false}
              showDate={false}
              onOpenItem={onOpenItem}
              onDropDay={onDropDay}
            />
          </div>
        );
      })}
    </div>
  );
}
