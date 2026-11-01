/**
 * How many prompt tokens the Studio planner's shared prefix costs on a model:
 * the system text plus the catalog reference, measured by the provider rather
 * than estimated from bytes. Run before and after a catalog change.
 *
 *   node scripts/chirpy-eval/probes/studio-prefix-tokens.mjs [model]
 */
import { loadEvalEnv } from "../env.mjs";
import { loadPlanner } from "../load-planner.mjs";
import { complete, usageSummary } from "../surplus.mjs";

loadEvalEnv();
await loadPlanner();
const model = process.argv[2] ?? "claude-haiku-5.5";
const { STUDIO_SYSTEM } =
  await import("../../../src/lib/chirpy/studio/prompt.ts").then(
    (mod) => mod.default ?? mod,
  );
const { studioCatalog, studioDefinitions } =
  await import("../../../src/lib/chirpy/studio/catalog.ts").then(
    (mod) => mod.default ?? mod,
  );

const reference = JSON.stringify({
  catalog: studioCatalog(),
  definitions: studioDefinitions(),
});

async function promptTokens(messages) {
  const reply = await complete({ model, max_tokens: 1, messages });
  if (reply.status !== 200) throw new Error(JSON.stringify(reply.error));
  return usageSummary(reply.usage).prompt;
}

const bare = await promptTokens([{ role: "user", content: "hi" }]);
const system = await promptTokens([
  { role: "system", content: STUDIO_SYSTEM },
  { role: "user", content: "hi" },
]);
const full = await promptTokens([
  { role: "system", content: STUDIO_SYSTEM },
  { role: "system", content: reference },
  { role: "user", content: "hi" },
]);
console.log(
  JSON.stringify({
    model,
    actions: studioCatalog().length,
    referenceBytes: reference.length,
    systemTokens: system - bare,
    catalogTokens: full - system,
    prefixTokens: full - bare,
  }),
);
