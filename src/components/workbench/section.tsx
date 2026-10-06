"use client";

/**
 * A section header for the shoot sheet.
 *
 * The old screen had nine identical tiny grey uppercase labels, which is the
 * same as having none: if everything is labelled at the same weight, the label
 * stops carrying information. Here the rank is explicit. A `lead` section gets
 * a real heading and a hairline that spans the column; a `quiet` one gets a
 * small label that stays out of the way of the content it names.
 */
export default function Section({
  title,
  rank = "lead",
  action,
  meta,
  children,
}: {
  title: string;
  rank?: "lead" | "quiet";
  action?: React.ReactNode;
  meta?: React.ReactNode;
  children: React.ReactNode;
}) {
  const lead = rank === "lead";

  return (
    <section>
      <header
        className={`flex flex-wrap items-baseline justify-between gap-x-3 gap-y-2 ${
          lead ? "border-border/70 mb-3 border-b pb-1.5" : "mb-1.5"
        }`}
      >
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
          <h2
            className={
              lead
                ? "text-foreground font-display text-sm font-semibold"
                : "text-muted-foreground text-xs font-semibold"
            }
          >
            {title}
          </h2>
          {meta && (
            <span className="text-muted-foreground min-w-0 text-xs [overflow-wrap:anywhere]">
              {meta}
            </span>
          )}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}
