/**
 * Day-streak math for the progress dashboard.
 *
 * Timezone decision: a "day" is a calendar day in the viewer's IANA timezone.
 * The browser reports it (`Intl.DateTimeFormat().resolvedOptions().timeZone`),
 * the API validates it and falls back to UTC. Sessions are stored as UTC
 * instants, so a 11pm rep in Los Angeles must not count as the next day just
 * because the server thinks in UTC; a streak is about the person's habit, so
 * it is counted in their day, not the server's.
 *
 * The streak is the run of consecutive practiced days ending today or
 * yesterday. Including yesterday keeps a live streak from reading zero at
 * midnight before today's practice happens.
 *
 * Calendar arithmetic (finding "the day before" a day key) runs on the key's
 * own year/month/day fields via Date.UTC, never on real timestamps, so DST
 * transitions cannot skip or double a day.
 */

/** True when `timeZone` is an IANA zone this runtime can format in. */
export function isValidTimeZone(timeZone: string): boolean {
  if (!timeZone) return false;
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone });
    return true;
  } catch {
    return false;
  }
}

/** The calendar day an instant falls on in `timeZone`, as "YYYY-MM-DD".
 * en-CA is the locale whose date format already is YYYY-MM-DD. */
export function dayKey(instant: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}

/** The day key one calendar day before `key`. Pure field arithmetic. */
function previousDayKey(key: string): string {
  const [year, month, day] = key.split("-").map(Number);
  const before = new Date(Date.UTC(year, month - 1, day) - 86_400_000);
  const y = before.getUTCFullYear();
  const m = String(before.getUTCMonth() + 1).padStart(2, "0");
  const d = String(before.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Consecutive practiced days ending today or yesterday, in `timeZone`.
 * Multiple sessions on one day count once. Returns 0 when the most recent
 * practiced day is before yesterday.
 */
export function dayStreak(
  sessions: readonly Date[],
  timeZone: string,
  now: Date = new Date(),
): number {
  if (sessions.length === 0) return 0;

  const practiced = new Set<string>();
  for (const session of sessions) practiced.add(dayKey(session, timeZone));

  const today = dayKey(now, timeZone);
  const yesterday = previousDayKey(today);
  let cursor = practiced.has(today)
    ? today
    : practiced.has(yesterday)
      ? yesterday
      : null;
  if (cursor === null) return 0;

  let streak = 0;
  while (practiced.has(cursor)) {
    streak += 1;
    cursor = previousDayKey(cursor);
  }
  return streak;
}
