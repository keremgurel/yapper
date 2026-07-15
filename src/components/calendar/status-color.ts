import type { ContentStatus } from "@/lib/db/schema";

/** The accent color for a scheduled item, by pipeline status. Drives the chip's
 * left bar so the calendar reads at a glance: what's posted vs still planned. */
export const STATUS_COLOR: Record<ContentStatus, string> = {
  drafted: "var(--sg-orange-400)",
  planned: "var(--sg-violet-500)",
  scheduled: "var(--sg-accent)",
  posted: "var(--sg-green-500)",
};
