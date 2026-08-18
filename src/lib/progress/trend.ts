/**
 * Latest-versus-earlier comparison for a score series, so "am I improving"
 * is one number instead of a feeling.
 *
 * The series is split into the latest window (the most recent `window`
 * entries) and everything before it. The delta is the difference of the two
 * unrounded means, rounded once at the end, so it never disagrees with the
 * displayed averages by a compounding rounding error of more than one point.
 */

/** How many recent reps count as "now". Shared with the dimension split. */
export const TREND_WINDOW = 5;

export interface ScoreTrend {
  /** The most recent score. */
  latest: number | null;
  /** Mean of the latest window, rounded. */
  latestAverage: number | null;
  /** Mean of everything before the latest window, rounded. */
  earlierAverage: number | null;
  /** latestAverage minus earlierAverage. Null until there is an earlier
   * window to compare against. */
  delta: number | null;
}

function mean(values: readonly number[]): number {
  let sum = 0;
  for (const value of values) sum += value;
  return sum / values.length;
}

/** `series` is chronological, oldest first. */
export function scoreTrend(
  series: readonly number[],
  window: number = TREND_WINDOW,
): ScoreTrend {
  if (series.length === 0 || window < 1) {
    return {
      latest: null,
      latestAverage: null,
      earlierAverage: null,
      delta: null,
    };
  }

  const split = Math.max(0, series.length - window);
  const latestWindow = series.slice(split);
  const earlier = series.slice(0, split);

  const latestMean = mean(latestWindow);
  const earlierMean = earlier.length > 0 ? mean(earlier) : null;

  return {
    latest: series[series.length - 1],
    latestAverage: Math.round(latestMean),
    earlierAverage: earlierMean === null ? null : Math.round(earlierMean),
    delta: earlierMean === null ? null : Math.round(latestMean - earlierMean),
  };
}
