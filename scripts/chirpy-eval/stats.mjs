/** Small statistics helpers for the report. */

export function mean(values) {
  return values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : null;
}

/** Nearest-rank percentile, p in [0, 100]. */
export function percentile(values, p) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.ceil((p / 100) * sorted.length);
  return sorted[Math.min(sorted.length, Math.max(1, rank)) - 1];
}

/**
 * Lower bound of the Wilson score interval for k successes in n trials
 * (two-sided 95% by default). Runs of the same case are correlated, so read
 * it as optimistic when runs per case is above one.
 */
export function wilsonLower(k, n, z = 1.96) {
  if (n === 0) return null;
  const p = k / n;
  const z2 = z * z;
  const centre = p + z2 / (2 * n);
  const spread = z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n));
  return (centre - spread) / (1 + z2 / n);
}
