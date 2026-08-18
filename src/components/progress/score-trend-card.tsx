"use client";

import ScoreSparkline, {
  type SparklinePoint,
} from "@/components/progress/score-sparkline";
import { formatSessionDay } from "@/components/progress/format";
import { StatBlock } from "@/components/studio-ui";
import type { ProgressSession, ProgressStats } from "@/lib/progress/types";

/** The comparison, stated in normal ink either way: a decline is information,
 * not an alarm. */
function comparisonLine(stats: ProgressStats): string {
  if (stats.overallDelta === null || stats.earlierAverage === null) {
    return "Keep going; the comparison starts once you have reps beyond your latest five.";
  }
  if (stats.overallDelta > 0) {
    return `Your last five reps average ${stats.overallDelta} above your earlier ${stats.earlierAverage}.`;
  }
  if (stats.overallDelta < 0) {
    return `Your last five reps average ${-stats.overallDelta} below your earlier ${stats.earlierAverage}.`;
  }
  return `Your last five reps average the same as your earlier ${stats.earlierAverage}.`;
}

/**
 * Overall score over time: latest, best and change StatBlocks over a
 * fixed-scale sparkline of every coached rep in the recent window.
 */
export default function ScoreTrendCard({
  stats,
  sessions,
}: {
  stats: ProgressStats | null;
  sessions: ProgressSession[] | null;
}) {
  if (stats === null || sessions === null) {
    return (
      <div className="bg-card border-border rounded-xl border p-4">
        <div
          aria-hidden
          className="bg-muted h-48 animate-pulse rounded-md motion-reduce:animate-none"
        />
      </div>
    );
  }

  const points: SparklinePoint[] = sessions
    .slice()
    .reverse()
    .filter((session) => session.scores !== null)
    .map((session) => ({
      label: formatSessionDay(session.createdAt),
      score: session.scores!.overall,
    }));

  if (points.length === 0) {
    return (
      <div className="bg-card border-border rounded-xl border p-4">
        <p className="text-muted-foreground text-sm">
          Your score line starts with your first coached rep.
        </p>
      </div>
    );
  }

  const delta =
    stats.overallDelta === null
      ? "-"
      : stats.overallDelta > 0
        ? `+${stats.overallDelta}`
        : String(stats.overallDelta);

  return (
    <div className="bg-card border-border rounded-xl border">
      <div className="divide-border grid grid-cols-3 divide-x">
        <StatBlock label="Latest" value={String(stats.latestOverall ?? "-")} />
        <StatBlock label="Best" value={String(stats.bestOverall ?? "-")} />
        <StatBlock label="Change" value={delta} />
      </div>
      <div className="px-4 pb-4">
        <ScoreSparkline points={points} />
        <p className="text-muted-foreground mt-2 text-xs">
          {comparisonLine(stats)}
        </p>
      </div>
    </div>
  );
}
