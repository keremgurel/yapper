/** List prices in USD per million tokens, from the Surplus catalog
 * (`GET /v1/models`, `pricing`) on 2026-10-30. Surplus settles far below
 * these. Budgets, margins and cost reports use list on purpose, so losing the
 * discount cannot turn a priced action into a loss without anyone noticing. */
export interface ModelPrice {
  input: number;
  cachedInput: number;
  output: number;
}

const PRICES: Readonly<Record<string, ModelPrice>> = {
  "gpt-5.4": { input: 2.5, cachedInput: 0.25, output: 15 },
  "gpt-5.4-mini": { input: 0.75, cachedInput: 0.075, output: 4.5 },
  "gpt-5.5": { input: 5, cachedInput: 0.5, output: 30 },
  "gemini-3.7-flash": { input: 0.75, cachedInput: 0.075, output: 3.75 },
  "claude-opus-4.7": { input: 5, cachedInput: 0.5, output: 25 },
  "claude-sonnet-4.6": { input: 3, cachedInput: 0.3, output: 15 },
};

/** A model missing from the table is priced high, never as free. */
export const UNKNOWN_MODEL_PRICE: ModelPrice = {
  input: 10,
  cachedInput: 10,
  output: 50,
};

export function modelPrice(model: string): ModelPrice {
  return PRICES[model] ?? UNKNOWN_MODEL_PRICE;
}
