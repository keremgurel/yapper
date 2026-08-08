/** Compact display for dashboard counts: 1234 becomes "1.2K", below 1000
 * stays exact. */
export function compactNumber(value: number): string {
  return new Intl.NumberFormat(undefined, {
    notation: value >= 1_000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(value);
}
