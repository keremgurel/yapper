"use client";

import { useCallback, useState } from "react";
import { addDays, addMonths, type CalendarView } from "@/lib/content/calendar";

/** Which period the calendar shows and how it moves: view (month/week) plus the
 * focused date, with prev/next/today. One concern; the rendering lives in the
 * components, the date math in lib/content/calendar. */
export function useCalendarNav(initial: Date = new Date()) {
  const [view, setView] = useState<CalendarView>("month");
  const [focus, setFocus] = useState<Date>(initial);

  const step = useCallback(
    (dir: 1 | -1) => {
      setFocus((f) =>
        view === "month" ? addMonths(f, dir) : addDays(f, dir * 7),
      );
    },
    [view],
  );

  const next = useCallback(() => step(1), [step]);
  const prev = useCallback(() => step(-1), [step]);
  const today = useCallback(() => setFocus(new Date()), []);

  return { view, setView, focus, next, prev, today };
}
