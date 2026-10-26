import { CHIP_TONES } from "@/components/studio-ui/chip-tones";
import type { ScheduleStatus } from "@/lib/publish/schedule-types";

interface StatusLook {
  label: string;
  /** Chip surface and text, from the shared tone system. */
  chip: string;
  /** Shown on the grid. Published posts appear as the platform's own posted
   * badge with views, and cancelled ones are gone. */
  onGrid: boolean;
}

const danger = "bg-destructive/10 text-destructive";

export const SCHEDULE_STATUS: Record<ScheduleStatus, StatusLook> = {
  scheduled: {
    label: "Scheduled",
    chip: `${CHIP_TONES.yellow.bg} text-foreground`,
    onGrid: true,
  },
  running: {
    label: "Sending",
    chip: `${CHIP_TONES.cyan.bg} text-foreground`,
    onGrid: true,
  },
  published: {
    label: "Published",
    chip: `${CHIP_TONES.green.bg} text-foreground`,
    onGrid: false,
  },
  draft: {
    label: "In TikTok drafts",
    chip: `${CHIP_TONES.green.bg} text-foreground`,
    onGrid: true,
  },
  failed: { label: "Needs a new time", chip: danger, onGrid: true },
  needs_attention: { label: "Check the platform", chip: danger, onGrid: true },
  cancelled: { label: "Cancelled", chip: "bg-muted", onGrid: false },
};

/** Statuses that need the creator to do something. */
export function needsAttention(status: ScheduleStatus): boolean {
  return status === "failed" || status === "needs_attention";
}
