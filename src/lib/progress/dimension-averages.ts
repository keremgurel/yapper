/**
 * Per-dimension averaging over the latest window versus the earlier window,
 * so the dashboard can show which skill is moving, not just the overall line.
 *
 * Generic over the dimension names so it stays a pure windowing module; the
 * caller passes `TRAINING_DIMENSIONS` (or anything else) and gets one entry
 * per dimension back.
 */

import { TREND_WINDOW } from "@/lib/progress/trend";

export interface DimensionWindowAverage {
  /** Mean of the latest window, rounded. Null with no records at all. */
  average: number | null;
  /** Latest mean minus the earlier mean, rounded once from unrounded means.
   * Null until there are records before the latest window. */
  delta: number | null;
}

function meanOf<D extends string>(
  records: ReadonlyArray<Record<D, number>>,
  dimension: D,
): number {
  let sum = 0;
  for (const record of records) sum += record[dimension];
  return sum / records.length;
}

/** `records` is chronological, oldest first. */
export function dimensionAverages<D extends string>(
  records: ReadonlyArray<Record<D, number>>,
  dimensions: readonly D[],
  window: number = TREND_WINDOW,
): Record<D, DimensionWindowAverage> {
  const result = {} as Record<D, DimensionWindowAverage>;

  if (records.length === 0 || window < 1) {
    for (const dimension of dimensions) {
      result[dimension] = { average: null, delta: null };
    }
    return result;
  }

  const split = Math.max(0, records.length - window);
  const latest = records.slice(split);
  const earlier = records.slice(0, split);

  for (const dimension of dimensions) {
    const latestMean = meanOf(latest, dimension);
    const earlierMean = earlier.length > 0 ? meanOf(earlier, dimension) : null;
    result[dimension] = {
      average: Math.round(latestMean),
      delta: earlierMean === null ? null : Math.round(latestMean - earlierMean),
    };
  }
  return result;
}
