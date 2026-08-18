/**
 * The wire contract for GET /api/training/progress: what the route returns and
 * what the dashboard renders. Pure types only, so both the Node route and the
 * client components can import it.
 */

import type {
  TrainingContext,
  TrainingDimension,
  TrainingScores,
} from "@/lib/training-feedback/types";

/** Mirrors `submissionStatuses` in the schema without pulling drizzle into
 * client bundles. */
export type ProgressSessionStatus =
  | "pending"
  | "processing"
  | "complete"
  | "failed";

/** One row of the recent-sessions table. */
export interface ProgressSession {
  id: string;
  /** ISO timestamp. */
  createdAt: string;
  durationSec: number | null;
  status: ProgressSessionStatus;
  context: TrainingContext | null;
  scores: TrainingScores | null;
}

export interface ProgressStats {
  /** Every training submission, coached or not. */
  totalReps: number;
  /** Submissions that produced scores. */
  coachedReps: number;
  minutesPracticed: number;
  dayStreak: number;
  /** All-time best overall score. Null until the first coached rep. */
  bestOverall: number | null;
  latestOverall: number | null;
  /** Mean overall score of the reps before the latest window. */
  earlierAverage: number | null;
  /** Latest-window average minus the earlier average. */
  overallDelta: number | null;
}

export interface DimensionProgressEntry {
  dimension: TrainingDimension;
  /** Latest-window average for this dimension. */
  average: number | null;
  /** Latest-window average minus the earlier average. */
  delta: number | null;
}

export interface TrainingProgressResponse {
  sessions: ProgressSession[];
  stats: ProgressStats;
  dimensions: DimensionProgressEntry[];
}
