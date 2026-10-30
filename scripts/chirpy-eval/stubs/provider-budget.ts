// Eval-only stand-in for the provider budget, wired in by tsconfig.eval.json.
// The real guard reserves spend in the production accounting database; an
// eval run must never write there. Everything else is the real module.
export * from "../../../src/lib/costs/provider-budget";

export function guardProviderEgress(): Promise<void> | null {
  return null;
}

export async function reserveProviderBudget(): Promise<void> {}

export async function reserveTikTokImportBudget(): Promise<void> {}
