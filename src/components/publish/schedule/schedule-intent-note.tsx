"use client";

import { useEffect, useState } from "react";
import { CalendarClock } from "lucide-react";
import { scheduleLabel } from "./quick-times";
import { useSchedulingAvailable } from "./use-scheduling-available";

/** Poster opened from a Calendar day says which time it will schedule for,
 * since nothing else on the page shows it until a video is open. */
export default function ScheduleIntentNote() {
  const available = useSchedulingAvailable();
  const [at, setAt] = useState<Date | null>(null);
  useEffect(() => {
    const value = new URLSearchParams(window.location.search).get("scheduleAt");
    const date = value ? new Date(value) : null;
    // Reading the URL after mount keeps server and client markup identical.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (date && date.getTime() > Date.now()) setAt(date);
  }, []);
  if (!at || !available) return null;
  return (
    <p className="text-muted-foreground flex items-center gap-2 text-sm">
      <CalendarClock aria-hidden className="size-4 shrink-0" />
      Choose a video to schedule for {scheduleLabel(at)}.
    </p>
  );
}
