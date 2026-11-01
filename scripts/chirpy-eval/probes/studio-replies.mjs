/**
 * Raw Studio planner replies for one case, repeated, to see why a plan fails
 * validation. Prints each model reply and the validator's verdict.
 *
 *   node scripts/chirpy-eval/probes/studio-replies.mjs <case-id> [runs] [model]
 */
import { loadEvalEnv } from "../env.mjs";
import { loadPlanner } from "../load-planner.mjs";
import { loadCases } from "../cases.mjs";
import { complete } from "../surplus.mjs";

loadEvalEnv();
await loadPlanner();
const [id, runs = "3", model = "claude-haiku-5.5"] = process.argv.slice(2);
const load = async (file) => {
  const mod = await import(`../../../${file}`);
  return mod.default ?? mod;
};
const prompt = await load("src/lib/chirpy/studio/prompt.ts");
const catalog = await load("src/lib/chirpy/studio/catalog.ts");
const planner = await load("src/lib/chirpy/studio/planner.ts");
const { cases } = await loadCases({ only: [id] });
const reference = JSON.stringify({
  catalog: catalog.studioCatalog(),
  definitions: catalog.studioDefinitions(),
});
for (let run = 0; run < Number(runs); run++) {
  const { input, overview } = cases[0].build();
  const reply = await complete({
    model,
    max_tokens: 2000,
    temperature: 0,
    messages: [
      { role: "system", content: prompt.STUDIO_SYSTEM },
      { role: "system", content: reference },
      { role: "user", content: planner.studioRequest(input, overview) },
    ],
  }).catch((error) => ({ content: `(request failed: ${error.message})` }));
  let raw = null;
  try {
    raw = JSON.parse(
      reply.content.slice(
        reply.content.indexOf("{"),
        reply.content.lastIndexOf("}") + 1,
      ),
    );
  } catch {}
  console.log(`#${run + 1}`, reply.content.replace(/\s+/g, " ").slice(0, 600));
  console.log("   issue:", raw ? catalog.studioPlanIssue(raw) : "unparseable");
}
