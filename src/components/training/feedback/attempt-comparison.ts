import type { DeliveryMetrics } from "@/lib/feedback/metrics";
import type { TrainingScores } from "@/lib/training-feedback/types";

export interface AttemptSnapshot {
  scores: TrainingScores | null;
  metrics: DeliveryMetrics | null;
}

export interface AttemptChange {
  label: string;
  before: number;
  after: number;
  /** Whether a larger number is the better one for this measure. */
  higherIsBetter: boolean;
}

/** `improved`, `worse` or `same`, read in the direction that matters. */
export function changeDirection(change: AttemptChange) {
  if (change.after === change.before) return "same" as const;
  return change.after > change.before === change.higherIsBetter
    ? ("improved" as const)
    : ("worse" as const);
}

const finite = (n: unknown): n is number =>
  typeof n === "number" && Number.isFinite(n);

/**
 * What moved between two attempts at the same prompt. Only measures present
 * in both attempts are compared, so an older record simply yields fewer rows.
 */
export function compareAttempts(
  previous: AttemptSnapshot,
  current: AttemptSnapshot,
): AttemptChange[] {
  const rows: [string, unknown, unknown, boolean][] = [
    ["Overall score", previous.scores?.overall, current.scores?.overall, true],
    [
      "Fillers per minute",
      previous.metrics?.fillerPerMin,
      current.metrics?.fillerPerMin,
      false,
    ],
    [
      "Mid-sentence pauses",
      previous.metrics?.midSentencePauseCount,
      current.metrics?.midSentencePauseCount,
      false,
    ],
    [
      "Long pauses",
      previous.metrics?.longPauseCount,
      current.metrics?.longPauseCount,
      false,
    ],
  ];
  return rows.flatMap(([label, before, after, higherIsBetter]) =>
    finite(before) && finite(after)
      ? [{ label, before, after, higherIsBetter }]
      : [],
  );
}
