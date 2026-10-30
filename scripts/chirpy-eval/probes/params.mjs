import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { withTurn, installFetchCapture } from "../capture.mjs";
import { loadCases } from "../cases.mjs";
import { list, parseArgs, stamp } from "../cli.mjs";
import { loadEvalEnv, ROOT } from "../env.mjs";
import { loadPlanner } from "../load-planner.mjs";
import { complete, usageSummary } from "../surplus.mjs";

/**
 * Do reasoning_effort and prompt_cache_retention pass through Surplus, and
 * do they change usage?
 *
 *   node scripts/chirpy-eval/probes/params.mjs [--models gpt-5.4,gpt-5.4-mini] \
 *     [--case cut-quoted-sentence] [--reps 2]
 *
 * It records the exact body the production planner sends for one case, then
 * replays it with one parameter changed per arm. Each arm's system prompt
 * gets its own nonce so caches never cross arms; each arm sends `reps`
 * calls back to back, so the later calls show whether caching held.
 */
const args = parseArgs();
loadEvalEnv();
const planner = await loadPlanner();
installFetchCapture();
const models = list(args.models ?? "gpt-5.4,gpt-5.4-mini");
const reps = Number(args.reps ?? 2);
const { cases } = await loadCases({
  only: [args.case ?? "cut-quoted-sentence"],
});

const arms = [
  { name: "as production", set: {} },
  { name: "reasoning_effort none", set: { reasoning_effort: "none" } },
  { name: "reasoning_effort low", set: { reasoning_effort: "low" } },
  { name: "reasoning_effort medium", set: { reasoning_effort: "medium" } },
  { name: "reasoning_effort high", set: { reasoning_effort: "high" } },
  { name: "reasoning {effort: high}", set: { reasoning: { effort: "high" } } },
  {
    name: "prompt_cache_retention 24h",
    set: { prompt_cache_retention: "24h" },
  },
  {
    name: "prompt_cache_retention in_memory",
    set: { prompt_cache_retention: "in_memory" },
  },
];

async function productionBody(model) {
  process.env.AI_CHIRPY_MODEL = model;
  const turn = await withTurn({ keepBodies: true }, () =>
    planner.planChirpy(cases[0].build()),
  );
  const body = turn.calls[0]?.body;
  if (!body)
    throw new Error(`no request captured for ${model}: ${turn.error?.message}`);
  return body;
}

const rows = [];
for (const model of models) {
  const template = await productionBody(model);
  await Promise.all(
    arms.map(async (arm) => {
      const nonce = randomUUID().slice(0, 8);
      for (let rep = 1; rep <= reps; rep++) {
        const body = structuredClone(template);
        body.messages[0].content = `Run ${nonce}.\n${body.messages[0].content}`;
        Object.assign(body, arm.set);
        const reply = await complete(body, { timeoutMs: 180_000 });
        const row = {
          model,
          arm: arm.name,
          rep,
          status: reply.status,
          error: reply.error?.message?.slice(0, 200) ?? null,
          ...usageSummary(reply.usage),
          elapsedMs: reply.elapsedMs,
          provider: reply.headers["x-si-provider-family"] ?? null,
          adapted: reply.headers["x-si-adapted-params"] ?? null,
        };
        rows.push(row);
        console.error(JSON.stringify(row));
      }
    }),
  );
}

const order = new Map(arms.map((arm, i) => [arm.name, i]));
rows.sort(
  (a, b) =>
    a.model.localeCompare(b.model) ||
    order.get(a.arm) - order.get(b.arm) ||
    a.rep - b.rep,
);
console.log(
  [
    "| Model | Arm | Rep | Status | Prompt tok | Cached | Output tok | Reasoning tok | Settled µ$ | Latency s | Provider | Adapted |",
    "| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |",
    ...rows.map(
      (r) =>
        `| ${r.model} | ${r.arm} | ${r.rep} | ${r.status}${r.error ? ` ${r.error.replace(/\|/g, "/")}` : ""} | ${r.prompt} | ${r.cached} | ${r.output} | ${r.reasoning} | ${r.settledMicro ?? ""} | ${(r.elapsedMs / 1000).toFixed(1)} | ${r.provider ?? ""} | ${r.adapted ?? ""} |`,
    ),
  ].join("\n"),
);
const out = path.join(
  ROOT,
  `scripts/chirpy-eval/results/probe-params-${stamp()}.json`,
);
await fs.mkdir(path.dirname(out), { recursive: true });
await fs.writeFile(out, JSON.stringify(rows, null, 2));
console.error(`results: ${path.relative(process.cwd(), out)}`);
