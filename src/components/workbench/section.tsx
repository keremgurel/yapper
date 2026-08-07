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
        className={`flex items-baseline justify-between gap-3 ${
          lead ? "border-border/70 mb-3 border-b pb-1.5" : "mb-1.5"
        }`}
      >
        <div className="flex items-baseline gap-2.5">
          <h2
            className={
              lead
                ? "text-foreground font-display text-[13px] font-black tracking-[0.14em] uppercase"
                : "text-muted-foreground text-[11px] font-bold tracking-[0.1em] uppercase"
            }
          >
            {title}
          </h2>
          {meta && (
            <span className="text-muted-foreground text-xs">{meta}</span>
          )}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}
