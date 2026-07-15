/**
 * Pure date math for the content calendar. All of it works in the viewer's
 * local time (a post scheduled for 9am shows on that local day), and none of it
 * touches React or the network, so it is unit-tested in isolation.
 */
export type CalendarView = "month" | "week";

export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function addMonths(d: Date, n: number): Date {
  const x = new Date(d);
  x.setMonth(x.getMonth() + n);
  return x;
}

export function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function isSameMonth(d: Date, focus: Date): boolean {
  return (
    d.getFullYear() === focus.getFullYear() && d.getMonth() === focus.getMonth()
  );
}

/** Local YYYY-MM-DD, the key we bucket scheduled items under. */
export function dayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** The Sunday that starts the week containing `d` (calendars here are Sun-first). */
export function startOfWeek(d: Date): Date {
  const x = startOfDay(d);
  return addDays(x, -x.getDay());
}

/** The 7 days of the week containing `focus`, Sunday first. */
export function weekDays(focus: Date): Date[] {
  const s = startOfWeek(focus);
  return Array.from({ length: 7 }, (_, i) => addDays(s, i));
}

/** The weeks (rows of 7 days) that make up the month grid for `focus`, padded
 * with the leading/trailing days needed to fill whole weeks. */
export function monthWeeks(focus: Date): Date[][] {
  const first = new Date(focus.getFullYear(), focus.getMonth(), 1);
  const lastOfMonth = new Date(focus.getFullYear(), focus.getMonth() + 1, 0);
  const weeks: Date[][] = [];
  let cursor = startOfWeek(first);
  while (cursor <= lastOfMonth) {
    weeks.push(Array.from({ length: 7 }, (_, i) => addDays(cursor, i)));
    cursor = addDays(cursor, 7);
  }
  return weeks;
}

export function monthLabel(d: Date): string {
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

export function weekLabel(focus: Date): string {
  const days = weekDays(focus);
  const a = days[0];
  const b = days[6];
  const left = a.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
  const right = b.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return `${left} - ${right}`;
}

/** Bucket items by their local day, each day's items sorted by time. Items
 * with no date are dropped. */
export function bucketByDay<T>(
  items: T[],
  getIso: (t: T) => string | null,
): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const it of items) {
    const iso = getIso(it);
    if (!iso) continue;
    const key = dayKey(new Date(iso));
    const arr = map.get(key);
    if (arr) arr.push(it);
    else map.set(key, [it]);
  }
  for (const arr of map.values()) {
    arr.sort(
      (x, y) => new Date(getIso(x)!).getTime() - new Date(getIso(y)!).getTime(),
    );
  }
  return map;
}

/** New ISO for moving an item to `targetDay`, keeping its original time of day
 * (or 9am if it had none). Used by drag-to-reschedule. */
export function rescheduleIso(
  currentIso: string | null,
  targetDay: Date,
): string {
  const d = startOfDay(targetDay);
  const cur = currentIso ? new Date(currentIso) : null;
  if (cur) d.setHours(cur.getHours(), cur.getMinutes(), 0, 0);
  else d.setHours(9, 0, 0, 0);
  return d.toISOString();
}
