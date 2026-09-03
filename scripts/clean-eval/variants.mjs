/**
 * Each variant is one set of switches over the production request.
 *
 * baseline is exactly what the route sends today. The others add one thing
 * each so the effect can be attributed; `all` stacks every improvement.
 */
const base = {
  maxCompletionTokens: 16_000,
  reasoning: null, // "low" | "medium" | "high"
  schema: false,
  repair: false,
  connectors: false,
  anchors: false,
  energy: false,
  contract: "keep", // "keep" (production since 2026-09-03) | "blocks" (legacy)
  lenient: false, // read legacy blocks forgivingly instead of failing closed
};

export const VARIANTS = {
  // Production as shipped: keep only contract, 8,000 token cap, nothing else.
  baseline: { ...base, maxCompletionTokens: 8_000 },
  "blocks-legacy": { ...base, contract: "blocks" },
  reasoning: { ...base, reasoning: "medium", maxCompletionTokens: 8_000 },
  schema: { ...base, schema: true },
  repair: { ...base, repair: true },
  connectors: { ...base, connectors: true },
  anchors: { ...base, anchors: true },
  energy: { ...base, energy: true },
  "blocks-lenient": { ...base, contract: "blocks", lenient: true },
  "blocks-all": {
    ...base,
    contract: "blocks",
    maxCompletionTokens: 8_000,
    reasoning: "medium",
    schema: true,
    repair: true,
    connectors: true,
    anchors: true,
    energy: true,
  },
  // Names kept from the 2026-09-03 runs so saved results still rescore.
  keeponly: { ...base },
  "keeponly-schema": { ...base, schema: true },
  "keeponly-energy": { ...base, energy: true },
  "keeponly-reason": {
    ...base,
    reasoning: "medium",
    maxCompletionTokens: 8_000,
  },
  "keeponly-full": {
    ...base,
    schema: true,
    energy: true,
    connectors: true,
    reasoning: "medium",
    maxCompletionTokens: 8_000,
  },
};

/** The saved 2026-09-03 result files used these names for the legacy contract. */
export const LEGACY_RESULT_NAMES = {
  baseline: "blocks-legacy",
  lenient: "blocks-lenient",
  all: "blocks-all",
};

export function pickVariants(names) {
  return names.map((name) => {
    const variant = VARIANTS[name];
    if (!variant) throw new Error(`unknown variant ${name}`);
    return { name, ...variant };
  });
}
