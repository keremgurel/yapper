import type { ReactNode } from "react";

/**
 * One act of the homepage argument: an intro that spans the page, then the
 * content beneath it.
 *
 * It deliberately does NOT put the intro in its own column. The showcase below
 * is already two columns, and nesting one inside the other produced three
 * columns of competing text with the media panel stranded in the leftover
 * space. The act introduces itself across the full width and then gets out of
 * the way.
 */
export default function ActSection({
  index,
  eyebrow,
  title,
  description,
  action,
  children,
}: {
  index: string;
  eyebrow: string;
  title: string;
  description: string;
  action: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="marketing-container py-16 sm:py-24">
      <div className="flex items-start gap-5 sm:gap-7">
        <span
          aria-hidden
          className="font-mono text-[40px] leading-none font-semibold text-[color:var(--sg-accent)] tabular-nums sm:text-[52px]"
        >
          {index}
        </span>
        <span
          aria-hidden
          className="mt-6 h-px flex-1 bg-gradient-to-r from-[color:var(--sg-accent)]/50 to-transparent"
        />
      </div>

      <div className="mt-8 grid gap-x-16 gap-y-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
        <div>
          <p className="text-muted-foreground text-[11px] font-bold tracking-[0.16em] uppercase">
            {eyebrow}
          </p>
          <h2 className="type-h2 mt-3">{title}</h2>
        </div>
        <div className="lg:pt-2">
          <p className="type-description max-w-[52ch] text-base">
            {description}
          </p>
          <div className="mt-6">{action}</div>
        </div>
      </div>

      <div className="mt-14 sm:mt-20">{children}</div>
    </section>
  );
}
