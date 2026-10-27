"use client";

import { CalendarClock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { scheduleLabel } from "./quick-times";

/** The primary action when posting later, labelled with the exact time. */
export default function ScheduleButton({
  at,
  count,
  saving,
  disabled,
  onSchedule,
}: {
  at: Date | null;
  count: number;
  saving: boolean;
  disabled: boolean;
  onSchedule: () => void;
}) {
  const valid = at && Number.isFinite(at.getTime());
  return (
    <Button type="button" onClick={onSchedule} disabled={disabled || !valid}>
      {saving ? (
        <Loader2 aria-hidden className="animate-spin" />
      ) : (
        <CalendarClock aria-hidden />
      )}
      {saving
        ? "Scheduling…"
        : valid
          ? `Schedule ${count === 1 ? "" : `${count} posts `}for ${scheduleLabel(at)}`
          : "Choose a time"}
    </Button>
  );
}
