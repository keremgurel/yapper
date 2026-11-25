import type { StyleFont } from "../format/style-definition";

/** Type and colour shared by the styles ported from the Ep. 15 edit. */

export const INTER = "Inter";

/** Inter with a system fallback, for a host that has not loaded the font yet. */
export const interStack = `var(--font-inter, "${INTER}"), "${INTER}", -apple-system, "Helvetica Neue", Arial, sans-serif`;

export const interFont = (
  weights: readonly number[],
  italic = false,
): StyleFont => ({
  family: INTER,
  weights,
  italic,
});

/** White text, two greys for secondary text, red for cost, green for value. Nothing else. */
export const ink = {
  text: "#FFFFFF",
  muted: "rgba(255,255,255,0.62)",
  faint: "rgba(255,255,255,0.38)",
  cost: "#FF7A6B",
  value: "#5BE3A0",
} as const;

/** The one text shadow: faint enough that white stays white, enough that it never disappears. */
export const faintTextShadow =
  "0 1px 2px rgba(0,0,0,0.35), 0 0 1px rgba(0,0,0,0.25)";
