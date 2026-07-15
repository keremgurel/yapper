export type RulerTick = { sec: number; x: number; label: string };

// Tick spacings (seconds) we allow, smallest first. The first that keeps marks
// at least ~90px apart wins, so labels never crowd. 0.5 is the finest, used only
// at deep zoom; 600 (10 min) is the coarse fallback for very long timelines.
const STEPS = [0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300];
const TARGET_PX = 90;

/**
 * Evenly spaced ruler marks across a timeline of `total` seconds at `pxPerSec`.
 * Each tick carries its time, its x offset, and an m:ss label. Pure.
 */
export function buildTicks(total: number, pxPerSec: number): RulerTick[] {
  if (total <= 0) return [];
  const raw = TARGET_PX / pxPerSec;
  const step = STEPS.find((s) => s >= raw) ?? 600;
  const out: RulerTick[] = [];
  for (let s = 0; s <= total + 0.001; s += step) {
    // Round to whole seconds BEFORE splitting into minutes and seconds, so a
    // sub-second tick at, say, 59.5s reads "1:00" and never the impossible
    // "0:60" that rounding only the seconds field would produce.
    const whole = Math.round(s);
    const m = Math.floor(whole / 60);
    const sec = whole % 60;
    out.push({
      sec: s,
      x: s * pxPerSec,
      label: `${m}:${String(sec).padStart(2, "0")}`,
    });
  }
  return out;
}
