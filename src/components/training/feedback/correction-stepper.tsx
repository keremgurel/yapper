import { ChevronLeft, ChevronRight } from "lucide-react";
import type { TrainingCorrection } from "@/lib/training-feedback/types";
import CorrectionDetail from "@/components/training/feedback/correction-detail";
import styles from "@/components/training/feedback/transcript.module.css";

/**
 * The fix for the phrase selected in the transcript, with buttons to walk
 * through every marked phrase in the order it was said.
 */
export default function CorrectionStepper({
  corrections,
  order,
  selected,
  onSelect,
}: {
  corrections: TrainingCorrection[];
  /** Indexes into `corrections` that are marked in the transcript, in order. */
  order: number[];
  selected: number;
  onSelect: (index: number) => void;
}) {
  const position = Math.max(0, order.indexOf(selected));
  const step = (by: number) =>
    onSelect(order[(position + by + order.length) % order.length]);
  return (
    <aside className={styles.stepper} aria-label="Corrections">
      <div className={styles.stepperBar}>
        <p aria-live="polite">
          Fix {position + 1} of {order.length}
        </p>
        {order.length > 1 && (
          <div>
            <button
              type="button"
              aria-label="Previous fix"
              onClick={() => step(-1)}
            >
              <ChevronLeft size={16} />
            </button>
            <button type="button" aria-label="Next fix" onClick={() => step(1)}>
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>
      <CorrectionDetail correction={corrections[selected]} />
    </aside>
  );
}
