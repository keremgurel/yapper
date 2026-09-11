/** Presentation timestamps, not a guessed frame rate (including VFR exports). */
export function presentationTimes(timestamps: readonly number[]): number[] {
  return [
    ...new Set(timestamps.filter((time) => Number.isFinite(time) && time >= 0)),
  ].sort((a, b) => a - b);
}

export function nearestFrame(times: readonly number[], time: number): number {
  if (!times.length || !Number.isFinite(time)) return 0;
  let low = 0;
  let high = times.length - 1;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (times[mid] < time) low = mid + 1;
    else high = mid;
  }
  return low > 0 && time - times[low - 1] <= times[low] - time ? low - 1 : low;
}

export function formatFrameTime(time: number): string {
  const milliseconds = Math.round(Math.max(0, time) * 1000);
  return `${Math.floor(milliseconds / 60000)}:${String(Math.floor(milliseconds / 1000) % 60).padStart(2, "0")}.${String(milliseconds % 1000).padStart(3, "0")}`;
}

/** Seek inside the frame's actual interval, avoiding timestamp rounding to its predecessor. */
export function framePreviewTime(
  times: readonly number[],
  index: number,
  duration: number,
): number {
  const start = times[index] ?? 0;
  const end = times[index + 1] ?? duration;
  return start + Math.max(0, end - start) / 2;
}
