import { and, eq, inArray } from "drizzle-orm";
import type {
  ScheduleCancelInput,
  ScheduleMoveInput,
} from "../../../../../protocol/app-actions.generated";
import { getDb } from "@/lib/db/client";
import type { PublishingSchedule } from "@/lib/db/publishing-schedules";
import { publishingSchedules } from "@/lib/db/schema";
import { changeSchedule } from "@/lib/publish/operations/change-schedule";
import { PLATFORMS } from "@/lib/publish/platforms";
import {
  failureFrom,
  StudioActionFailure,
  type StudioActionDefinition,
  type StudioNames,
} from "../executor";
import { dayLabel } from "../ideas/when";
import { videoTitle } from "../poster/reads";
import { localLabel, postingInstant } from "./when";

/** “Gym myths” on TikTok. */
export function scheduleLabel(row: { title: string; platform: string }) {
  const platform =
    PLATFORMS[row.platform as keyof typeof PLATFORMS]?.label ?? row.platform;
  return `“${videoTitle(row.title)}” on ${platform}`;
}

/** “Gym myths” on TikTok and YouTube, when one post goes to both. */
function scheduleList(rows: readonly { title: string; platform: string }[]) {
  const byTitle = new Map<string, string[]>();
  for (const row of rows) {
    const title = videoTitle(row.title);
    const platform =
      PLATFORMS[row.platform as keyof typeof PLATFORMS]?.label ?? row.platform;
    byTitle.set(title, [...(byTitle.get(title) ?? []), platform]);
  }
  const parts = [...byTitle].map(([title, platforms]) => {
    const where =
      platforms.length === 1
        ? platforms[0]
        : `${platforms.slice(0, -1).join(", ")} and ${platforms.at(-1)}`;
    return `“${title}” on ${where}`;
  });
  return parts.length <= 2
    ? parts.join(" and ")
    : `${parts[0]} and ${parts.length - 1} more posts`;
}

/** The creator's own schedules among the ids, refusing when none are. */
async function ownSchedules(
  userId: string,
  ids: readonly string[],
): Promise<PublishingSchedule[]> {
  const rows = await getDb()
    .select()
    .from(publishingSchedules)
    .where(
      and(
        eq(publishingSchedules.userId, userId),
        inArray(publishingSchedules.id, [...ids]),
      ),
    );
  if (!rows.length)
    throw new StudioActionFailure(
      "not_found",
      "I couldn’t find that scheduled post. It may have gone out or been canceled.",
    );
  return rows;
}

const CONFLICTS: Record<string, string> = {
  schedule_already_started:
    "has already started going out, so it can’t change now",
  scheduling_unavailable: "can’t be moved while scheduling is paused",
};

function changeFailure(
  row: PublishingSchedule,
  refusal: Parameters<typeof failureFrom>[0],
) {
  const reason = CONFLICTS[refusal.error];
  return reason
    ? new StudioActionFailure(refusal.error, `${scheduleLabel(row)} ${reason}.`)
    : failureFrom(refusal, scheduleLabel(row));
}

function described(ids: readonly string[], names: StudioNames) {
  const known = ids.map((id) => names.schedules?.[id]).filter(Boolean);
  return known.length === ids.length
    ? known.length === 1
      ? known[0]!
      : `${known.length} scheduled posts (${known.join(", ")})`
    : `${ids.length} scheduled post${ids.length === 1 ? "" : "s"}`;
}

/** Runs only after the creator confirms, through the same change as the
 * calendar's Reschedule control. */
export const rescheduleAction: StudioActionDefinition<ScheduleMoveInput> = {
  async run({ scheduleIDs, date, time }, { userId, timeZone }) {
    const rows = await ownSchedules(userId, scheduleIDs);
    const moved: PublishingSchedule[] = [];
    let last: Date | null = null;
    for (const row of rows) {
      const at = postingInstant(date, time, row.scheduledFor, timeZone);
      const result = await changeSchedule(userId, row.id, "reschedule", at);
      if (!result.ok) throw changeFailure(row, result);
      moved.push(result.value);
      last = at;
    }
    return {
      summary: `Moved ${scheduleList(moved)} to ${dayLabel(last!, timeZone, true)}.`,
      effects: ["schedules", "ideas"],
    };
  },
  describe({ scheduleIDs, date, time }, names) {
    return `Move ${described(scheduleIDs, names)} to ${localLabel(date, time)}`;
  },
  confirm: { label: "Move it", cancel: "Keep it" },
};

/** Runs only after the creator confirms, through the same change as the
 * calendar's Cancel control. */
export const cancelAction: StudioActionDefinition<ScheduleCancelInput> = {
  async run({ scheduleIDs }, { userId }) {
    const rows = await ownSchedules(userId, scheduleIDs);
    const canceled: PublishingSchedule[] = [];
    for (const row of rows) {
      const result = await changeSchedule(userId, row.id, "cancel");
      if (!result.ok) throw changeFailure(row, result);
      canceled.push(result.value);
    }
    return {
      summary: `Canceled ${scheduleList(canceled)}. The video and its idea are still there.`,
      effects: ["schedules"],
    };
  },
  describe({ scheduleIDs }, names) {
    return `Cancel ${described(scheduleIDs, names)}`;
  },
  confirm: { label: "Cancel it", note: "It won’t go out.", cancel: "Keep it" },
};
