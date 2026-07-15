const UNITS = [
  { div: 1_000_000_000, suffix: "B" },
  { div: 1_000_000, suffix: "M" },
  { div: 1_000, suffix: "K" },
] as const;

/** Compact engagement-count formatting: 1400000 → "1.4M", 12900 → "12.9K".
 * Rolls over cleanly at unit boundaries (999999 → "1M", not "1000K") and scales
 * up to billions. */
export function formatCount(n: number): string {
  if (!Number.isFinite(n) || n < 1) return "0";
  if (n < 1000) return String(Math.round(n));
  for (const { div, suffix } of UNITS) {
    // Nudge the boundary down by half a rounding step so a value that would
    // round up into the next unit (999999 → "1M") lands there, not "1000K".
    if (n >= div * 0.9995) {
      const v = n / div;
      const label =
        v >= 100
          ? String(Math.round(v))
          : (Math.round(v * 10) / 10).toFixed(1).replace(/\.0$/, "");
      return `${label}${suffix}`;
    }
  }
  return String(Math.round(n));
}
