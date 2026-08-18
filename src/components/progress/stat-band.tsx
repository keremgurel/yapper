import { StatBlock } from "@/components/studio-ui";
import type { ProgressStats } from "@/lib/progress/types";

/**
 * The one Level-1 card of headline numbers: StatBlocks separated by hairlines,
 * never a bordered box per stat. `stats: null` keeps the band's shape with
 * StatBlock skeletons while the payload loads.
 */
export default function StatBand({ stats }: { stats: ProgressStats | null }) {
  return (
    <div className="bg-card border-border divide-border grid grid-cols-2 rounded-xl border sm:grid-cols-4 sm:divide-x">
      <StatBlock
        label="Reps coached"
        value={stats === null ? null : String(stats.coachedReps)}
        detail={stats === null ? undefined : `of ${stats.totalReps} recorded`}
      />
      <StatBlock
        label="Minutes practiced"
        value={stats === null ? null : String(stats.minutesPracticed)}
      />
      <StatBlock
        label="Day streak"
        value={stats === null ? null : String(stats.dayStreak)}
        detail={
          stats !== null && stats.dayStreak >= 2 ? "days in a row" : undefined
        }
      />
      <StatBlock
        label="Best score"
        value={
          stats === null
            ? null
            : stats.bestOverall === null
              ? "-"
              : String(stats.bestOverall)
        }
        detail={
          stats !== null && stats.bestOverall === null
            ? "no coached reps yet"
            : undefined
        }
      />
    </div>
  );
}
