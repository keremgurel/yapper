/** Shared numeral formatting for the delivery strip and correction detail. */

/** Seconds to a m:ss clock string. */
export function formatClock(sec: number): string {
  const whole = Math.max(0, Math.round(sec));
  const m = Math.floor(whole / 60);
  const s = whole % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** A 0-1 ratio as a whole percent string. */
export function formatPercent(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}
