/**
 * What worked and what to work on, side by side. When one list is empty the
 * other takes the full width; when both are empty the parent skips the
 * section entirely.
 */
export default function StrengthsImprovements({
  strengths,
  improvements,
}: {
  strengths: string[];
  improvements: string[];
}) {
  const columns = [
    {
      title: "What worked",
      items: strengths,
      dot: "bg-[color:var(--sg-green-500)]",
    },
    {
      title: "What to work on",
      items: improvements,
      dot: "bg-[color:var(--sg-cyan-500)]",
    },
  ].filter((c) => c.items.length > 0);

  if (columns.length === 0) return null;

  return (
    <div className={`grid gap-6 ${columns.length > 1 ? "sm:grid-cols-2" : ""}`}>
      {columns.map((col) => (
        <div key={col.title}>
          <h3 className="text-foreground text-sm font-semibold">{col.title}</h3>
          <ul className="mt-2 space-y-2">
            {col.items.map((item, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <span
                  aria-hidden
                  className={`mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full ${col.dot}`}
                />
                <p className="text-foreground max-w-[68ch] text-[15px] leading-relaxed">
                  {item}
                </p>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
