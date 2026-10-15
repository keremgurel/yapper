/** How a post did against the typical one, as a chip says it: "3.2×" under
 * ten, "12×" from ten up, and "<0.1×" for a post far below the typical one,
 * which would otherwise read "0.0×". The Mac app's `HomeNumber.multiplier`. */
export function multiplierLabel(times: number): string {
  if (times < 0.1) return "<0.1×";
  return times >= 10 ? `${Math.round(times)}×` : `${times.toFixed(1)}×`;
}
