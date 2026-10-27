/** A one-tap time offered next to the date field. */
export interface QuickTime {
  label: string;
  at: Date;
}

function at(base: Date, daysAhead: number, hour: number): Date {
  const date = new Date(base);
  date.setDate(date.getDate() + daysAhead);
  date.setHours(hour, 0, 0, 0);
  return date;
}

/**
 * Tomorrow morning, tomorrow evening and the coming Saturday morning, in the
 * creator's own time zone. Saturday is skipped when it is tomorrow, since
 * tomorrow is already offered.
 */
export function quickTimes(now: Date): QuickTime[] {
  const time = (date: Date) =>
    date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const morning = at(now, 1, 9);
  const evening = at(now, 1, 18);
  const options = [
    { label: `Tomorrow, ${time(morning)}`, at: morning },
    { label: `Tomorrow, ${time(evening)}`, at: evening },
  ];
  const untilSaturday = (6 - now.getDay() + 7) % 7 || 7;
  if (untilSaturday > 1) {
    const saturday = at(now, untilSaturday, 10);
    options.push({
      label: `${saturday.toLocaleDateString(undefined, { weekday: "short" })}, ${time(saturday)}`,
      at: saturday,
    });
  }
  return options;
}

/** "Tue, Oct 28, 9:00 AM": short enough for a button. */
export function scheduleLabel(date: Date): string {
  return date.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** The earliest time the server accepts, with a little room to submit. */
export const MIN_LEAD_MS = 2 * 60_000;
