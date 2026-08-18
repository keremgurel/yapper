import { Chip } from "@/components/studio-ui";
import type {
  StructuralGap,
  StructuralGapKind,
} from "@/lib/training-feedback/types";

const KIND_LABELS: Record<StructuralGapKind, string> = {
  missing_hook: "Missing hook",
  missing_close: "Missing close",
};

/**
 * Absences the transcript cannot show inline. Yellow is the caution hue for
 * both severities; a high-severity gap gets one extra line of priority, not
 * a louder color.
 */
export default function StructuralGaps({ gaps }: { gaps: StructuralGap[] }) {
  if (gaps.length === 0) return null;

  return (
    <ul className="space-y-4">
      {gaps.map((gap, i) => (
        <li key={i} className="flex items-start gap-3">
          <Chip tone="yellow">{KIND_LABELS[gap.kind]}</Chip>
          <div className="min-w-0">
            <p className="text-foreground max-w-[68ch] text-[15px] leading-relaxed">
              {gap.note}
            </p>
            {gap.severity === "high" && (
              <p className="text-muted-foreground mt-0.5 text-xs">
                Worth fixing first.
              </p>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
