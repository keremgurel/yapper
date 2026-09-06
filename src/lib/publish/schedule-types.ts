import type { PublishPlatform } from "@/lib/db/schema";

export const scheduleStatuses = [
  "scheduled",
  "running",
  "published",
  "draft",
  "failed",
  "needs_attention",
  "cancelled",
] as const;
export type ScheduleStatus = (typeof scheduleStatuses)[number];

/** Immutable copy/cover/source for one destination, reviewed before arming. */
export interface ScheduledPublishInput {
  mediaKey: string;
  contentItemId?: string;
  title?: string;
  description?: string;
  tags?: string[];
  caption?: string;
  privacyStatus?: "private" | "unlisted" | "public";
  thumbnailKey?: string;
}

export interface ScheduleSummary {
  id: string;
  platform: PublishPlatform;
  accountLabel: string;
  title: string;
  scheduledFor: string;
  timezone: string;
  status: ScheduleStatus;
  error: string | null;
  externalUrl: string | null;
  contentItemId: string | null;
}

export function schedulingEnabled(): boolean {
  return (
    process.env.STUDIO_SCHEDULER_ENABLED === "1" &&
    Boolean(process.env.CRON_SECRET)
  );
}
