"use client";

/** A dropdown of content pillars. Generic: the caller supplies the options (the
 * user's pillars, or the distinct pillars present in a list) and the empty-value
 * label ("No pillar" for editing, "All pillars" for filtering). If `value` isn't
 * in `options` (a custom/LLM-invented pillar), it's shown anyway so it's never
 * silently dropped. */
export default function PillarSelect({
  value,
  onChange,
  options,
  emptyLabel,
  className,
  ariaLabel,
}: {
  value: string | null;
  onChange: (pillar: string | null) => void;
  options: string[];
  emptyLabel: string;
  className?: string;
  ariaLabel?: string;
}) {
  const opts =
    value && !options.includes(value) ? [value, ...options] : options;

  return (
    <select
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value || null)}
      aria-label={ariaLabel}
      className={
        className ??
        "border-border bg-card text-foreground/80 h-9 cursor-pointer rounded-md border px-3 text-sm"
      }
    >
      <option value="">{emptyLabel}</option>
      {opts.map((name) => (
        <option key={name} value={name}>
          {name}
        </option>
      ))}
    </select>
  );
}
