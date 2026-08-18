import type { ReactNode } from "react";

/**
 * One act of the homepage argument.
 *
 * The site already has a numbered rail in the Studio workflow tour, so the
 * homepage borrows that idea rather than inventing a third grammar: an
 * oversized act numeral, a hairline accent rail running down beside it, and
 * one block of content. It reads as the same system without repeating the
 * tour's layout.
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
      <div className="grid gap-10 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:gap-16">
        {/* The rail. On wide screens it runs the height of the act and the
            numeral hangs off it; on narrow ones it collapses to a short
            horizontal tick so the column can stack. */}
        <div className="relative lg:sticky lg:top-28 lg:self-start">
          <div className="flex items-center gap-4 lg:flex-col lg:items-start lg:gap-5">
            <span
              aria-hidden
              className="font-mono text-[44px] leading-none font-semibold text-[color:var(--sg-accent)] tabular-nums sm:text-[56px]"
            >
              {index}
            </span>
            <span
              aria-hidden
              className="h-px flex-1 bg-gradient-to-r from-[color:var(--sg-accent)] to-transparent lg:h-24 lg:w-px lg:flex-none lg:bg-gradient-to-b"
            />
          </div>

          <p className="text-muted-foreground mt-6 text-[11px] font-bold tracking-[0.16em] uppercase">
            {eyebrow}
          </p>
          <h2 className="type-h2 mt-3">{title}</h2>
          <p className="type-description mt-5 max-w-[46ch] text-base">
            {description}
          </p>
          <div className="mt-7">{action}</div>
        </div>

        <div className="min-w-0">{children}</div>
      </div>
    </section>
  );
}
