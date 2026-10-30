import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { list, parseArgs, stamp } from "../cli.mjs";
import { loadEvalEnv, ROOT } from "../env.mjs";
import { loadPlanner } from "../load-planner.mjs";
import { complete, usageSummary } from "../surplus.mjs";
import { actionTools, loadContract } from "./strict-transform.mjs";
import { studioTools } from "./studio-tools.mjs";

/**
 * Does a static prefix of the Chirpy system prompt plus about 100 strict
 * tools stay cached across separate calls, different requests and idle
 * gaps?
 *
 *   node scripts/chirpy-eval/probes/cache-tools.mjs \
 *     [--models gpt-5.4,gpt-5.4-mini] [--waits 5,15]
 *
 * Each model gets three arms: an explicit prompt_cache_key, no key, and a
 * key with prompt_cache_retention "24h". Each arm's system prompt starts
 * with its own nonce so arms and earlier runs never share a cache. Calls 1
 * and 2 run back to back with different user requests; each later call
 * waits the given minutes after the previous one (so 5,15 means about 5 and
 * then 20 minutes after the start). Every call ends with a different
 * request, as different users would send.
 */
const args = parseArgs();
loadEvalEnv();
const { system } = await loadPlanner();
const contract = await loadContract();
const models = list(args.models ?? "gpt-5.4,gpt-5.4-mini");
const waits = list(args.waits ?? "5,15").map(Number);
const tools = [...actionTools(contract).map((t) => t.tool), ...studioTools()];
const nonce = randomUUID().slice(0, 8);
const requests = [
  "make the captions a bit bigger",
  "cut the second sentence",
  "add a whoosh at the playhead",
  "make all overlays full screen",
  "turn the captions yellow",
];
const arms = [
  {
    name: "key",
    fields: (arm) => ({ prompt_cache_key: `chirpy-probe:${nonce}:${arm}` }),
  },
  { name: "no key", fields: () => ({}) },
  {
    name: "key + 24h retention",
    fields: (arm) => ({
      prompt_cache_key: `chirpy-probe:${nonce}:${arm}`,
      prompt_cache_retention: "24h",
    }),
  },
];

function body(model, arm, step) {
  return {
    model,
    max_completion_tokens: 600,
    tools,
    tool_choice: "auto",
    messages: [
      {
        role: "system",
        content: `Probe ${nonce}, ${model}, arm ${arm.name}.\n${system}`,
      },
      {
        role: "user",
        content: JSON.stringify({
          context: { duration: 30, playhead: 4 + step },
          request: requests[step % requests.length],
        }),
      },
    ],
    ...arm.fields(`${model}:${arm.name}`),
  };
}

const rows = [];
const started = Date.now();
async function step(index, label) {
  await Promise.all(
    models.flatMap((model) =>
      arms.map(async (arm) => {
        const reply = await complete(body(model, arm, index), {
          timeoutMs: 180_000,
        });
        const usage = usageSummary(reply.usage);
        const row = {
          model,
          arm: arm.name,
          call: index + 1,
          label,
          minutesFromStart: Number(
            ((Date.now() - started) / 60_000).toFixed(1),
          ),
          status: reply.status,
          error: reply.error?.message?.slice(0, 200) ?? null,
          ...usage,
          cacheShare: usage.prompt ? usage.cached / usage.prompt : 0,
          elapsedMs: reply.elapsedMs,
          provider: reply.headers["x-si-provider-family"] ?? null,
          adapted: reply.headers["x-si-adapted-params"] ?? null,
        };
        rows.push(row);
        console.error(JSON.stringify(row));
      }),
    ),
  );
}

console.error(
  `${tools.length} strict tools, nonce ${nonce}, waits ${waits.join(", ")} min`,
);
await step(0, "cold");
await step(1, "immediately, different request");
for (const [i, minutes] of waits.entries()) {
  await new Promise((resolve) => setTimeout(resolve, minutes * 60_000));
  await step(i + 2, `${minutes} min after previous call`);
}

rows.sort(
  (a, b) =>
    a.model.localeCompare(b.model) ||
    a.arm.localeCompare(b.arm) ||
    a.call - b.call,
);
console.log(
  [
    "| Model | Arm | Call | When | Status | Prompt tok | Cached | Cache hit | Settled µ$ | Latency s | Provider | Adapted |",
    "| --- | --- | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |",
    ...rows.map(
      (r) =>
        `| ${r.model} | ${r.arm} | ${r.call} | ${r.label} | ${r.status}${r.error ? ` ${r.error.replace(/\|/g, "/")}` : ""} | ${r.prompt} | ${r.cached} | ${Math.round(r.cacheShare * 100)}% | ${r.settledMicro ?? ""} | ${(r.elapsedMs / 1000).toFixed(1)} | ${r.provider ?? ""} | ${r.adapted ?? ""} |`,
    ),
  ].join("\n"),
);
const out = path.join(
  ROOT,
  `scripts/chirpy-eval/results/probe-cache-tools-${stamp()}.json`,
);
await fs.mkdir(path.dirname(out), { recursive: true });
await fs.writeFile(
  out,
  JSON.stringify({ nonce, tools: tools.length, waits, rows }, null, 2),
);
console.error(`results: ${path.relative(process.cwd(), out)}`);
