import type { DimensionProgressEntry } from "@/lib/progress/types";
import { DIMENSION_LABELS } from "@/lib/training-feedback/types";

function deltaLabel(delta: number | null): string {
  if (delta === null) return "no earlier reps to compare";
  if (delta > 0) return `+${delta} vs earlier`;
  if (delta < 0) return `${delta} vs earlier`;
  return "level with earlier";
}

function Row({ entry }: { entry: DimensionProgressEntry }) {
  return (
    <div className="flex min-h-10 items-center gap-4 py-2">
      <p className="text-foreground w-44 shrink-0 text-sm font-medium">
        {DIMENSION_LABELS[entry.dimension]}
      </p>
      {/* The meter repeats the number visually; the number carries the value.
          The fill takes the same informational cyan as DimensionMeter, which
          renders this data on the feedback surface. */}
      <div aria-hidden className="bg-muted h-1.5 min-w-0 flex-1 rounded-full">
        <div
          className="h-full rounded-full bg-[color:var(--sg-cyan-500)]"
          style={{ width: `${entry.average ?? 0}%` }}
        />
      </div>
      <p className="text-foreground w-8 shrink-0 text-right font-mono text-sm font-semibold tabular-nums">
        {entry.average ?? "-"}
      </p>
      <p className="text-muted-foreground hidden w-44 shrink-0 text-right text-xs sm:block">
        {deltaLabel(entry.delta)}
      </p>
    </div>
  );
}

/**
 * The five dimensions with their latest-window average and the change against
 * the earlier window, so someone can see which skill is moving.
 */
export default function DimensionProgress({
  dimensions,
}: {
  dimensions: DimensionProgressEntry[] | null;
}) {
  if (dimensions === null) {
    return (
      <div className="divide-border/60 divide-y">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="flex min-h-10 items-center py-2">
            <div
              aria-hidden
              className="bg-muted h-4 w-full animate-pulse rounded-md motion-reduce:animate-none"
            />
          </div>
        ))}
      </div>
    );
  }

  if (dimensions.every((entry) => entry.average === null)) {
    return (
      <p className="text-muted-foreground text-sm">
        Dimension scores show up after your first coached rep.
      </p>
    );
  }

  return (
    <div className="divide-border/60 divide-y">
      {dimensions.map((entry) => (
        <Row key={entry.dimension} entry={entry} />
      ))}
    </div>
  );
}
