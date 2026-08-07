"use client";

/**
 * One label/value pair in the shoot rail.
 *
 * Inline rather than stacked. The rail previously ran four uppercase micro
 * labels down the page, each above its control, which turned a summary card
 * into a form. A row with the name on the left and the value on the right
 * reads at a glance and takes half the height.
 */
export default function RailRow({
  label,
  children,
  align = "center",
}: {
  label: string;
  children: React.ReactNode;
  align?: "center" | "start";
}) {
  return (
    <div
      className={`flex gap-3 ${
        align === "start" ? "items-start" : "items-center"
      } justify-between`}
    >
      <span className="text-muted-foreground shrink-0 text-xs font-bold">
        {label}
      </span>
      <div className="min-w-0 text-right">{children}</div>
    </div>
  );
}
