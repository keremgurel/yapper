/**
 * A variant rewrites the planner's outgoing request body, so one option can
 * be measured on the production prompt without editing planner.ts.
 * `baseline` sends exactly what production sends. Each rewrite returns the
 * fields it changed so a result row shows what was actually sent.
 */
function setFields(fields) {
  return (body) =>
    Object.entries(fields).map(([name, value]) => {
      const before = body[name];
      body[name] = value;
      return before === undefined ? name : `${name} (was ${before})`;
    });
}

export const VARIANTS = {
  baseline: {},
  "effort-none": { rewrite: setFields({ reasoning_effort: "none" }) },
  "effort-low": { rewrite: setFields({ reasoning_effort: "low" }) },
  "effort-medium": { rewrite: setFields({ reasoning_effort: "medium" }) },
  "effort-high": { rewrite: setFields({ reasoning_effort: "high" }) },
  "cache-key": { rewrite: setFields({ prompt_cache_key: "chirpy-eval:v1" }) },
};

export function pickVariants(names) {
  return names.map((name) => {
    const variant = VARIANTS[name];
    if (!variant) throw new Error(`unknown variant ${name}`);
    return { name, ...variant };
  });
}
