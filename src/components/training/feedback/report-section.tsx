import type { ReactNode } from "react";

/** One titled part of the feedback report, in sentence case with a quiet
 * rule above it. */
export default function ReportSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="border-border/70 border-t pt-6">
      <h2 className="text-foreground mb-4 text-[19px] font-medium tracking-[-0.02em]">
        {title}
      </h2>
      {children}
    </section>
  );
}
