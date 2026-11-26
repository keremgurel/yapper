import type { ReactNode } from "react";

/** One source in the picker: its name, then its videos or what to do. */
export default function SourceShelf({
  id,
  icon,
  title,
  children,
}: {
  id: string;
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <section
      id={`poster-shelf-${id}`}
      aria-labelledby={`poster-shelf-${id}-title`}
      className="scroll-mt-24 space-y-3"
    >
      <h3
        id={`poster-shelf-${id}-title`}
        className="text-foreground flex items-center gap-2 text-sm font-semibold"
      >
        {icon}
        {title}
      </h3>
      {children}
    </section>
  );
}
