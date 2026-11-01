import { after } from "next/server";
import {
  changePublishingSchedule,
  ScheduleConflict,
  type PublishingSchedule,
} from "@/lib/db/publishing-schedules";
import {
  refused,
  succeeded,
  type OperationResult,
} from "@/lib/http/operation-result";
import { syncPlanDates } from "@/lib/publish/schedule-plan-date";
import { schedulingEnabled } from "@/lib/publish/schedule-types";
import { wakePublishClock } from "@/lib/publish/schedule-wake";

export type ScheduleChange = "cancel" | "reschedule" | "retry";

/**
 * Cancel, move or retry one of the creator's scheduled posts. The calendar
 * (through /api/publish/schedules/[id]) and Chirpy share it. `date` is
 * already validated as a time the clock can still send; a move also moves
 * the idea's plan date and wakes the clock for the new time.
 */
export async function changeSchedule(
  userId: string,
  id: string,
  action: ScheduleChange,
  date?: Date,
): Promise<OperationResult<PublishingSchedule>> {
  if (action !== "cancel" && !schedulingEnabled())
    return refused(503, "scheduling_unavailable");
  try {
    const row = await changePublishingSchedule(userId, id, action, date);
    if (!row) return refused(404, "not_found");
    if (date) {
      await syncPlanDates(userId, [row.contentItemId], date);
      after(() => wakePublishClock(date));
    }
    return succeeded(row);
  } catch (error) {
    if (error instanceof ScheduleConflict) return refused(409, error.message);
    throw error;
  }
}
