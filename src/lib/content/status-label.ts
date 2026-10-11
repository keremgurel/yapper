import type { ContentStatus } from "@/lib/db/schema";

/** How a pipeline status reads in the UI. One map, so a chip, a column and a
 * filter never disagree (the view filter once fell back to raw keys). */
export const STATUS_LABEL: Record<ContentStatus, string> = {
  captured: "Captured",
  drafting: "Drafting",
  ready: "Ready",
  posted: "Posted",
};
