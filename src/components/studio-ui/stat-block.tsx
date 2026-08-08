/**
 * One number on a dashboard: quiet label, mono value, one line of context.
 *
 * Borderless on purpose. Compose several inside a single Level-1 card with
 * `divide-x divide-border`; a bordered box per stat is the nested-border
 * anti-pattern. `value: null` keeps the block's shape with a skeleton instead
 * of rendering placeholder punctuation.
 */
export default function StatBlock({
  label,
  value,
  detail,
}: {
  label: string;
  value: string | null;
  detail?: string;
}) {
  return (
    <div className="min-w-0 p-4 sm:p-5">
      <p className="text-muted-foreground text-[11px] font-bold tracking-[0.1em] uppercase">
        {label}
      </p>
      {value === null ? (
        <div
          aria-hidden
          className="bg-muted mt-2.5 h-7 w-16 animate-pulse rounded-md"
        />
      ) : (
        <p className="text-foreground mt-1.5 font-mono text-[26px] font-semibold tracking-[-0.01em] tabular-nums">
          {value}
        </p>
      )}
      {detail && (
        <p className="text-muted-foreground mt-1 truncate text-xs">{detail}</p>
      )}
    </div>
  );
}
