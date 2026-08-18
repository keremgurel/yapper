import type { DeliveryMetrics } from "@/lib/feedback/metrics";
import {
  formatClock,
  formatPercent,
} from "@/components/training/feedback/format-metric";
import MetricChip from "@/components/training/feedback/metric-chip";

/**
 * The measured delivery numbers as one row of quiet chips. Every entry guards
 * against a missing or non-finite value so a partial metrics payload just
 * renders fewer chips instead of NaN.
 */
export default function DeliveryStrip({
  metrics,
}: {
  metrics: DeliveryMetrics;
}) {
  const entries: { value: string; label: string }[] = [];
  const add = (n: number | undefined, value: string, label: string) => {
    if (typeof n === "number" && Number.isFinite(n)) {
      entries.push({ value, label });
    }
  };

  add(metrics.durationSec, formatClock(metrics.durationSec), "duration");
  add(metrics.wpm, `${Math.round(metrics.wpm)}`, "words / min");
  add(
    metrics.fillerCount,
    `${metrics.fillerCount}`,
    metrics.fillerCount === 1 ? "filler" : "fillers",
  );
  add(metrics.fillerPerMin, `${metrics.fillerPerMin}`, "fillers / min");
  add(
    metrics.pauseCount,
    `${metrics.pauseCount}`,
    metrics.pauseCount === 1 ? "pause" : "pauses",
  );
  add(metrics.longestPauseSec, `${metrics.longestPauseSec}s`, "longest pause");
  add(
    metrics.typeTokenRatio,
    formatPercent(metrics.typeTokenRatio),
    "vocabulary variety",
  );

  if (entries.length === 0) {
    return (
      <p className="text-muted-foreground text-[13px]">
        No delivery numbers came back for this rep.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {entries.map((e) => (
        <MetricChip key={e.label} value={e.value} label={e.label} />
      ))}
    </div>
  );
}
