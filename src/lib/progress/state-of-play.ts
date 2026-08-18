/**
 * The one-line "where you are" sentence under the dashboard title. Pure so
 * the copy branches are testable; the numbers come straight from the stats
 * payload and a decline is stated as plainly as a gain.
 */

import type { ProgressStats } from "@/lib/progress/types";

export function stateOfPlay(stats: ProgressStats): string {
  if (stats.totalReps === 0) {
    return "Nothing on the record yet. Your first coached rep starts it.";
  }
  if (stats.latestOverall === null) {
    return "Reps recorded. Scores show up after your first coached rep.";
  }

  const parts = [`Latest score ${stats.latestOverall}`];
  if (stats.overallDelta !== null) {
    if (stats.overallDelta > 0) {
      parts.push(`up ${stats.overallDelta} on your earlier average`);
    } else if (stats.overallDelta < 0) {
      parts.push(`down ${-stats.overallDelta} on your earlier average`);
    } else {
      parts.push("level with your earlier average");
    }
  }

  const sentence = `${parts.join(", ")}.`;
  if (stats.dayStreak >= 2) {
    return `${sentence} ${stats.dayStreak} days running.`;
  }
  return sentence;
}
