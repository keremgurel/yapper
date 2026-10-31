import {
  isLocalDay,
  isLocalTime,
  localTime,
  zonedInstant,
} from "../zoned-time";
import { StudioActionFailure } from "../executor";

/** A calendar drop lands at 09:00 local, like a drag onto the calendar. */
export const DEFAULT_TIME = "09:00";

/**
 * The instant for "put it on <day>": the day in the creator's zone, at the
 * time asked for, else the time the idea already had, else 09:00. The same
 * rule as dragging an idea to another day on the calendar.
 */
export function scheduledInstant(
  day: string,
  time: string | undefined,
  current: Date | null,
  timeZone: string,
): Date {
  if (!isLocalDay(day))
    throw new StudioActionFailure(
      "bad_date",
      "I couldn’t read that date. Try a day like Friday or Nov 6.",
    );
  if (time !== undefined && !isLocalTime(time))
    throw new StudioActionFailure(
      "bad_time",
      "I couldn’t read that time. Try something like 9am or 18:30.",
    );
  const keep = current ? localTime(current, timeZone) : DEFAULT_TIME;
  return zonedInstant(day, time ?? keep, timeZone);
}

/** “Fri, Oct 31” or “Fri, Oct 31 at 6:30 PM”, as the creator's clock reads. */
export function dayLabel(at: Date, timeZone: string, withTime = false) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    month: "short",
    day: "numeric",
    ...(withTime ? { hour: "numeric", minute: "2-digit" } : {}),
  })
    .format(at)
    .replace(/, (\d+:\d\d)/, " at $1");
}
