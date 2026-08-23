"use client";

/**
 * How much of a surface's allowance a part of the brain is using.
 *
 * Worth showing rather than hiding because the number is the whole reason the
 * system exists. A creator who can see that their core is nearly full
 * understands why promoting a sixth section to "always" would push something
 * out, and that is a decision they can only make with the figure in front of
 * them.
 */
export default function BudgetMeter({
  label,
  used,
  total,
  hint,
}: {
  label: string;
  used: number;
  total: number;
  hint?: string;
}) {
  const share = total > 0 ? Math.min(1, used / total) : 0;
  // Amber past four fifths: not an error, but the point where the next thing
  // added starts costing something else its place.
  const tight = share > 0.8;

  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-muted-foreground text-[11px] font-bold tracking-[0.1em] uppercase">
          {label}
        </span>
        <span className="text-muted-foreground font-mono text-xs tabular-nums">
          {used} / {total}
        </span>
      </div>
      <div className="bg-muted h-1 overflow-hidden rounded-full">
        <div
          className={`h-full rounded-full transition-[width] duration-[--sg-dur-base] ${
            tight
              ? "bg-[color:var(--sg-yellow-500)]"
              : "bg-[color:var(--sg-cyan-500)]"
          }`}
          style={{ width: `${Math.round(share * 100)}%` }}
        />
      </div>
      {hint && <p className="text-muted-foreground text-xs">{hint}</p>}
    </div>
  );
}
