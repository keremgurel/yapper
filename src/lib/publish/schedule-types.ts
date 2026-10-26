import type { PublishPlatform } from "@/lib/db/schema";
import type { TikTokDirectSettings } from "./tiktok-direct-settings";

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
  selfDeclaredMadeForKids?: boolean;
  containsSyntheticMedia?: boolean;
  thumbnailKey?: string;
  /** TikTok only. Present means a reviewed Direct Post; absent means the video
   * goes to the creator's TikTok drafts. */
  settings?: TikTokDirectSettings;
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

/** Scheduling needs the flag and at least one way for a worker to be let in:
 * Vercel Cron's CRON_SECRET or the publish clock's own secret. */
export function schedulingEnabled(): boolean {
  return (
    process.env.STUDIO_SCHEDULER_ENABLED === "1" &&
    Boolean(process.env.CRON_SECRET || process.env.PUBLISH_SCHEDULER_SECRET)
  );
}

/** A TikTok schedule without reviewed Direct Post settings lands in drafts. */
export function sendsTikTokDraft(
  platform: PublishPlatform,
  input: Pick<ScheduledPublishInput, "settings">,
): boolean {
  return platform === "tiktok" && !input.settings;
}
