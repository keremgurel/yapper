import { CHIP_TONES, type ChipTone } from "@/components/studio-ui/chip-tones";

/**
 * The one colored label. Hue identifies the value; shape identifies the
 * system, so three chip systems can share a table row without blurring:
 * status = tint + pill, format = tint (square), pillar = dot.
 */
export default function Chip({
  tone = "neutral",
  variant = "tint",
  pill = false,
  className = "",
  children,
}: {
  tone?: ChipTone;
  variant?: "tint" | "dot";
  pill?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const t = CHIP_TONES[tone];
  const radius = pill ? "rounded-full" : "rounded-md";

  if (variant === "dot") {
    return (
      <span
        className={`bg-muted text-foreground/75 inline-flex max-w-full items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ${className}`}
      >
        <span
          aria-hidden
          className={`h-1.5 w-1.5 shrink-0 rounded-full ${t.dot}`}
        />
        <span className="truncate">{children}</span>
      </span>
    );
  }

  return (
    <span
      className={`inline-flex max-w-full items-center gap-1 px-2 py-0.5 text-[11px] font-semibold ${radius} ${t.bg} ${t.fg} ${className}`}
    >
      <span className="truncate">{children}</span>
    </span>
  );
}
