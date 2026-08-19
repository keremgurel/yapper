"use client";

import { CalendarDays, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ScheduleSpacing } from "@/components/publish/poster/use-schedule";

const FIELD =
  "bg-muted text-foreground rounded-lg px-3 py-2 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--sg-accent)]";

/** Placing the selected batch on the calendar. Scheduling is not publishing,
 * so this is never the accent-filled action on the page. */
export default function ScheduleFields({
  at,
  spacing,
  state,
  count,
  onAt,
  onSpacing,
  onSchedule,
}: {
  at: string;
  spacing: ScheduleSpacing;
  state: "idle" | "saving" | "done";
  count: number;
  onAt: (at: string) => void;
  onSpacing: (spacing: ScheduleSpacing) => void;
  onSchedule: () => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="grid gap-2 sm:grid-cols-[1fr_140px]">
        <input
          type="datetime-local"
          value={at}
          aria-label="First post date and time"
          onChange={(event) => onAt(event.target.value)}
          className={FIELD}
        />
        <select
          value={spacing}
          aria-label="Spacing between posts"
          onChange={(event) => onSpacing(event.target.value as ScheduleSpacing)}
          className={FIELD}
        >
          <option value="daily">One per day</option>
          <option value="same">Same time</option>
        </select>
      </div>
      <Button
        type="button"
        variant="outline"
        disabled={count === 0 || state === "saving"}
        onClick={onSchedule}
      >
        {state === "saving" ? (
          <Loader2 aria-hidden className="animate-spin" />
        ) : state === "done" ? (
          <CheckCircle2 aria-hidden />
        ) : (
          <CalendarDays aria-hidden />
        )}
        {state === "saving"
          ? "Scheduling…"
          : state === "done"
            ? "Added to calendar"
            : `Schedule ${count || ""} selected`}
      </Button>
    </div>
  );
}
