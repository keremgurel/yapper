import { ArrowRight } from "lucide-react";
import { Chip } from "@/components/studio-ui";
import type { TrainingCorrection } from "@/lib/training-feedback/types";
import {
  CORRECTION_LABELS,
  CORRECTION_TONES,
} from "@/components/training/feedback/correction-tones";
import { formatClock } from "@/components/training/feedback/format-metric";

/**
 * The full story of one correction: what was said, the fix (or that the span
 * should simply go), and the reason. Rendered in a sunken well so it can sit
 * inside the transcript card without nesting borders.
 */
export default function CorrectionDetail({
  correction,
}: {
  correction: TrainingCorrection;
}) {
  return (
    <div className="bg-muted max-w-[68ch] space-y-2 rounded-lg p-3">
      <div className="flex items-center gap-2">
        <Chip tone={CORRECTION_TONES[correction.type]}>
          {CORRECTION_LABELS[correction.type]}
        </Chip>
        {correction.start != null && (
          <span className="text-muted-foreground text-xs">
            at{" "}
            <span className="font-mono tabular-nums">
              {formatClock(correction.start)}
            </span>
          </span>
        )}
      </div>
      <p className="text-muted-foreground text-sm leading-relaxed line-through">
        {correction.original}
      </p>
      <p className="text-foreground flex items-start gap-1.5 text-sm leading-relaxed font-medium">
        <ArrowRight
          aria-hidden
          className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0"
        />
        {correction.fix ?? "Leave it out"}
      </p>
      {correction.note && (
        <p className="text-muted-foreground text-[13px] leading-relaxed">
          {correction.note}
        </p>
      )}
    </div>
  );
}
