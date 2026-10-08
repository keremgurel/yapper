import { planByKey, TRIAL_CREDITS } from "./plans";

export interface CreditMeter {
  fraction: number | null;
  allowance: number | null;
  lightColor: string;
  darkColor: string;
  planLabel: string;
}

// ACL Academy's slider palette, reversed: low credits are coral, full is green.
const light = ["#d63b3b", "#b7791f", "#0e9f6e"];
const dark = ["#ff6b6b", "#ffc247", "#34d399"];

function blend(stops: string[], fraction: number): string {
  const segment = fraction <= 0.5 ? 0 : 1;
  const weight = (fraction - segment * 0.5) * 2;
  const channels = (hex: string) =>
    [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const from = channels(stops[segment]);
  const to = channels(stops[segment + 1]);
  return `#${from
    .map((value, i) =>
      Math.round(value + (to[i] - value) * weight)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

/** Plan allocation is the reference, not a claim that purchased credits expire.
 * Unknown allocations stay neutral instead of inventing a percentage. */
export function creditMeterFor({
  balance,
  plan,
  trialing,
  entitled,
}: {
  balance: number;
  plan: string | null;
  trialing: boolean;
  entitled: boolean;
}): CreditMeter {
  const membership = planByKey(plan);
  const allocation = trialing
    ? TRIAL_CREDITS
    : membership?.product === "studio"
      ? membership.includedCredits
      : null;
  const allowance = allocation && allocation > 0 ? allocation : null;
  const fraction = Number.isFinite(balance)
    ? balance <= 0
      ? 0
      : allowance
        ? Math.min(1, balance / allowance)
        : null
    : null;
  return {
    allowance,
    fraction,
    lightColor: fraction === null ? "#737373" : blend(light, fraction),
    darkColor: fraction === null ? "#a3a3a3" : blend(dark, fraction),
    planLabel: trialing
      ? "Studio trial"
      : entitled && membership?.product === "studio"
        ? `Studio Creator · ${membership.name.toLowerCase()}`
        : "No active membership",
  };
}
