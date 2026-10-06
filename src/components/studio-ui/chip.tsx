import { CHIP_TONES, type ChipTone } from "@/components/studio-ui/chip-tones";

/** A compact label. Icons and actions stay outside the truncating text box. */
export default function Chip({
  tone = "neutral",
  variant = "tint",
  pill = false,
  className = "",
  icon,
  endAdornment,
  children,
}: {
  tone?: ChipTone;
  variant?: "tint" | "dot";
  pill?: boolean;
  className?: string;
  icon?: React.ReactNode;
  endAdornment?: React.ReactNode;
  children: React.ReactNode;
}) {
  const t = CHIP_TONES[tone];
  return (
    <span
      data-slot="chip"
      className={`inline-flex min-h-6 max-w-full shrink-0 items-center gap-1.5 px-2 py-0.5 align-middle text-[11px] leading-4 font-semibold whitespace-nowrap ${pill || variant === "dot" ? "rounded-full" : "rounded-md"} ${variant === "dot" ? "bg-muted text-foreground/75" : `${t.bg} ${t.fg}`} ${className}`}
    >
      {variant === "dot" && (
        <span
          aria-hidden
          className={`size-1.5 shrink-0 rounded-full ${t.dot}`}
        />
      )}
      {icon && (
        <span
          aria-hidden
          className="inline-flex shrink-0 items-center [&>svg]:size-3"
        >
          {icon}
        </span>
      )}
      <span
        className="min-w-0 truncate"
        title={typeof children === "string" ? children : undefined}
      >
        {children}
      </span>
      {endAdornment && (
        <span className="inline-flex shrink-0 items-center">
          {endAdornment}
        </span>
      )}
    </span>
  );
}
