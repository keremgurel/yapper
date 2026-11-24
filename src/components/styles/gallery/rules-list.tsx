import type { StyleRule } from "@/lib/style-library/format/style-definition";

/** Why the block looks the way it does: each decision with the reason behind it. */
export default function RulesList({ rules }: { rules: readonly StyleRule[] }) {
  return (
    <ol className="space-y-3">
      {rules.map((entry, index) => (
        <li key={entry.rule} className="flex gap-3">
          <span className="text-muted-foreground font-mono text-xs tabular-nums">
            {index + 1}
          </span>
          <div className="min-w-0">
            <p className="text-foreground text-[13px] leading-relaxed">
              {entry.rule}
            </p>
            {entry.why && (
              <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
                {entry.why}
              </p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
