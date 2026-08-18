/**
 * One delivery number as a quiet chip: mono numeral first, plain label after.
 * Neutral by design; delivery metrics are measurements, not statuses.
 */
export default function MetricChip({
  value,
  label,
}: {
  value: string;
  label: string;
}) {
  return (
    <span className="bg-muted inline-flex items-baseline gap-1.5 rounded-md px-2.5 py-1">
      <span className="text-foreground font-mono text-[13px] font-semibold tabular-nums">
        {value}
      </span>
      <span className="text-muted-foreground text-[11px] font-semibold">
        {label}
      </span>
    </span>
  );
}
