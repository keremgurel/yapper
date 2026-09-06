import type { PublishingSchedule } from "@/lib/db/publishing-schedules";
import type { ScheduleSummary } from "./schedule-types";

export function scheduleSummary(row: PublishingSchedule): ScheduleSummary {
  return {
    id: row.id,
    platform: row.platform,
    accountLabel: row.accountLabel,
    title: row.title,
    scheduledFor: row.scheduledFor.toISOString(),
    timezone: row.timezone,
    status: row.status,
    error: row.error,
    externalUrl: row.externalUrl,
    contentItemId: row.contentItemId,
  };
}
