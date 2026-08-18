import { Chip } from "@/components/studio-ui";
import {
  CORRECTION_TYPES,
  type TrainingCorrection,
} from "@/lib/training-feedback/types";
import {
  CORRECTION_LABELS,
  CORRECTION_TONES,
} from "@/components/training/feedback/correction-tones";

/**
 * One chip per correction type present in this rep, with its count, in the
 * same tones the transcript marks use.
 */
export default function CorrectionLegend({
  corrections,
}: {
  corrections: TrainingCorrection[];
}) {
  const counts = new Map<string, number>();
  for (const c of corrections) {
    counts.set(c.type, (counts.get(c.type) ?? 0) + 1);
  }
  if (counts.size === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {CORRECTION_TYPES.filter((t) => counts.has(t)).map((t) => (
        <Chip key={t} tone={CORRECTION_TONES[t]}>
          {CORRECTION_LABELS[t]} {counts.get(t)}
        </Chip>
      ))}
      <span className="text-muted-foreground text-xs">
        Select a marked phrase to see the fix.
      </span>
    </div>
  );
}
