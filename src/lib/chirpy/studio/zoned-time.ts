/**
 * Calendar days in the creator's own time zone, on the server. The calendar
 * buckets a scheduled idea under the viewer's local day and drops new ones at
 * 09:00, so "Friday" from Chirpy has to mean the same local day and hour.
 */

const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isTimeZone(value: unknown): value is string {
  if (typeof value !== "string" || !value || value.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export function isLocalDay(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = DAY.exec(value);
  if (!match) return false;
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function isLocalTime(value: unknown): value is string {
  return typeof value === "string" && TIME.test(value);
}

interface LocalParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: string;
}

function localParts(at: Date, timeZone: string): LocalParts {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      weekday: "long",
    })
      .formatToParts(at)
      .map((part) => [part.type, part.value]),
  );
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    weekday: parts.weekday,
  };
}

const pad = (value: number) => String(value).padStart(2, "0");

/** YYYY-MM-DD of an instant in a time zone. */
export function localDay(at: Date, timeZone: string): string {
  const { year, month, day } = localParts(at, timeZone);
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** HH:MM (24-hour) of an instant in a time zone. */
export function localTime(at: Date, timeZone: string): string {
  const { hour, minute } = localParts(at, timeZone);
  return `${pad(hour)}:${pad(minute)}`;
}

export function weekdayOf(at: Date, timeZone: string): string {
  return localParts(at, timeZone).weekday;
}

/** Milliseconds the zone is ahead of UTC at that instant. */
function offsetAt(at: Date, timeZone: string): number {
  const p = localParts(at, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
  return asUtc - Math.floor(at.getTime() / 60_000) * 60_000;
}

/** The instant a local day and time names in a time zone. A time skipped by a
 * daylight-saving change resolves to the same wall time an hour later. */
export function zonedInstant(
  day: string,
  time: string,
  timeZone: string,
): Date {
  const [year, month, date] = day.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const wall = Date.UTC(year, month - 1, date, hour, minute);
  let guess = wall - offsetAt(new Date(wall), timeZone);
  // A second pass settles instants near a daylight-saving change, where the
  // offset at the first guess is not the offset at the answer.
  guess = wall - offsetAt(new Date(guess), timeZone);
  return new Date(guess);
}

/** The next week of local days from today, so a model reading "Friday" picks
 * a date instead of doing calendar arithmetic. */
export function upcomingDays(
  now: Date,
  timeZone: string,
  count = 8,
): { date: string; weekday: string }[] {
  const days: { date: string; weekday: string }[] = [];
  // Noon steps stay inside the intended day across daylight-saving changes.
  const today = localDay(now, timeZone);
  const start = zonedInstant(today, "12:00", timeZone).getTime();
  for (let index = 0; index < count; index++) {
    const at = new Date(start + index * 86_400_000);
    days.push({
      date: localDay(at, timeZone),
      weekday: weekdayOf(at, timeZone),
    });
  }
  return days;
}
