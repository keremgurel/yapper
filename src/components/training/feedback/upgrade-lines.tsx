import type { UpgradeLine } from "@/lib/training-feedback/types";

/**
 * Lines worth re-saying: the original struck through above the stronger
 * rewrite, stacked in one card so each pair reads as a single object.
 */
export default function UpgradeLines({ lines }: { lines: UpgradeLine[] }) {
  if (lines.length === 0) return null;

  return (
    <div className="bg-card border-border divide-border/60 divide-y rounded-xl border">
      {lines.map((line, i) => (
        <div key={i} className="p-4">
          <p className="text-muted-foreground max-w-[68ch] text-sm leading-relaxed line-through">
            {line.before}
          </p>
          <p className="text-foreground mt-1 max-w-[68ch] text-[15px] leading-relaxed font-medium">
            {line.after}
          </p>
        </div>
      ))}
    </div>
  );
}
