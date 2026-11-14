import type { SceneNumberNode } from "./scene-types";

/** A clock value as m:ss: the value is seconds, rounded to the nearest
 * second, and minutes past 59 stay minutes. Mirrors SceneNumberFormatter in
 * the app, which draws it. */
export function formatClock(seconds: number): string {
  const total = Math.round(Math.abs(seconds));
  const sign = seconds < 0 && total > 0 ? "-" : "";
  const minutes = Math.floor(total / 60);
  const rest = String(total % 60).padStart(2, "0");
  return `${sign}${minutes}:${rest}`;
}

/** Roughly the text a number node shows at `value`, for the layout
 * preflight. Generous rather than exact; the app's own metrics are the final
 * check. */
export function sceneNumberText(
  node: Pick<SceneNumberNode, "format" | "prefix" | "suffix">,
  value: number,
): string {
  const body =
    node.format === "clock"
      ? formatClock(value)
      : new Intl.NumberFormat("en-US", {
          maximumFractionDigits: node.format === "decimal1" ? 1 : 0,
        }).format(value) + (node.format === "percent" ? "%" : "");
  return `${node.prefix}${body}${node.suffix}`;
}
