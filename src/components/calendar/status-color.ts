import type { ContentStatus } from "@/lib/db/schema";

/** The accent color for a scheduled item, by pipeline status. Drives the chip's
 * left bar so the calendar reads at a glance: what's posted vs still planned. */
export const STATUS_COLOR: Record<ContentStatus, string> = {
  captured: "var(--sg-ink-400)",
  drafting: "var(--sg-cyan-500)",
  ready: "var(--sg-accent)",
  posted: "var(--sg-green-500)",
};
