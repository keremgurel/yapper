import { SCHEDULE_HORIZON_MS } from "@/lib/publish/schedule-input";
import { StudioActionFailure } from "../executor";
import { scheduledInstant } from "../ideas/when";

/**
 * The instant a post would go out on "<day> at <time>", in the creator's zone,
 * keeping the post's current time when none is given. Refused when the
 * publish clock could not send it: in the past, or more than 90 days out, the
 * same window the calendar's own pickers allow.
 */
export function postingInstant(
  day: string,
  time: string | undefined,
  current: Date | null,
  timeZone: string,
  now = Date.now(),
): Date {
  const at = scheduledInstant(day, time, current, timeZone);
  if (at.getTime() < now + 60_000)
    throw new StudioActionFailure(
      "time_passed",
      "That time has already passed. Pick a later one.",
    );
  if (at.getTime() > now + SCHEDULE_HORIZON_MS)
    throw new StudioActionFailure(
      "too_far",
      "Posts can be scheduled up to 90 days ahead. Pick an earlier day.",
    );
  return at;
}

/** “Fri, Nov 6” or “Fri, Nov 6 at 9:00 AM” from the local day and time the
 * planner wrote, for a question asked before anything runs. */
export function localLabel(day: string, time?: string): string {
  const [hour, minute] = (time ?? "12:00").split(":").map(Number);
  const at = new Date(`${day}T00:00:00Z`);
  at.setUTCHours(hour, minute);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
    ...(time ? { hour: "numeric", minute: "2-digit" } : {}),
  })
    .format(at)
    .replace(/, (\d+:\d\d)/, " at $1");
}
