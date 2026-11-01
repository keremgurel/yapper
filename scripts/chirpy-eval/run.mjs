import fs from "node:fs/promises";
import path from "node:path";
import { runAttempt } from "./attempt.mjs";
import { installFetchCapture } from "./capture.mjs";
import { loadCases } from "./cases.mjs";
import { loadEvalEnv, ROOT } from "./env.mjs";
import { loadPlanner } from "./load-planner.mjs";
import { markdownReport } from "./report.mjs";
import { catalog } from "./surplus.mjs";
import { list, parseArgs, stamp } from "./cli.mjs";
import { pickVariants } from "./variants.mjs";

/**
 * Chirpy planner evaluation against the production planner in src/.
 *
 *   node scripts/chirpy-eval/run.mjs --models gpt-5.4,gpt-5.4-mini --runs 3 \
 *     [--variants baseline,effort-low] [--cases id,id] [--tags safety] \
 *     [--payload captured.json,...] [--concurrency 4] [--out results.jsonl] \
 *     [--report report.md] [--dry]
 *
 * Models run one after another because the planners read the model from the
 * environment (AI_CHIRPY_MODEL, and AI_CHIRPY_STUDIO_MODEL for Studio cases);
 * attempts inside a model run concurrently, run-major, so repeats of a case
 * are spread out. Every attempt is appended to the JSONL as it finishes, so
 * a killed run keeps what it measured; report.mjs re-renders any JSONL.
 */
const args = parseArgs();

loadEvalEnv();
const models = list(args.models ?? "gpt-5.4");
const variants = pickVariants(list(args.variants ?? "baseline"));
const runs = Number(args.runs ?? 1);
const concurrency = Number(args.concurrency ?? 4);
const out =
  args.out ?? path.join(ROOT, `scripts/chirpy-eval/results/${stamp()}.jsonl`);
const { cases, skipped } = await loadCases({
  only: list(args.cases),
  tags: list(args.tags),
  payloads: list(args.payload),
});
if (!cases.length) throw new Error("no cases selected");

console.error(
  `${cases.length} cases (${cases.filter((c) => c.safety).length} safety) × ${models.length} models × ${variants.length} variants × ${runs} runs = ${cases.length * models.length * variants.length * runs} turns` +
    (skipped.length ? `\nskipped: ${skipped.join("; ")}` : ""),
);

if (args.dry === "true") {
  for (const testCase of cases) {
    const input = testCase.build();
    console.log(
      `${testCase.id.padEnd(30)} ${testCase.tags.join(",").padEnd(28)} ${input.studio ? "studio" : `${input.catalog.length} actions`}, context ${JSON.stringify(input.context).length} chars, ${input.messages.length} messages`,
    );
  }
  process.exit(0);
}

const planner = await loadPlanner();
for (const testCase of cases.filter((c) => c.tags.includes("captured")))
  if (!planner.parsePlanInput(testCase.build()))
    throw new Error(
      `${testCase.id}: captured payload is not a valid plan request`,
    );
installFetchCapture();
const prices = await catalog();
for (const model of models)
  if (!prices.has(model))
    console.error(
      `warning: ${model} is not in the Surplus catalog; list cost will be blank`,
    );

await fs.mkdir(path.dirname(path.resolve(out)), { recursive: true });
const attempts = [];
for (const model of models) {
  process.env.AI_CHIRPY_MODEL = model;
  process.env.AI_CHIRPY_STUDIO_MODEL = model;
  const jobs = [];
  for (let run = 1; run <= runs; run++)
    for (const variant of variants)
      for (const testCase of cases) jobs.push({ testCase, variant, run });
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, jobs.length) }, async () => {
      while (next < jobs.length) {
        const job = jobs[next++];
        const attempt = await runAttempt({ planner, model, prices, ...job });
        attempts.push(attempt);
        await fs.appendFile(out, JSON.stringify(attempt) + "\n");
        console.error(
          `${model} ${job.variant.name} #${job.run} ${job.testCase.id}: ${attempt.pass ? "pass" : "FAIL"}` +
            ` ${(attempt.elapsedMs / 1000).toFixed(1)}s ${attempt.callCount} call(s)` +
            (attempt.listUsd != null
              ? ` list $${attempt.listUsd.toFixed(4)}`
              : "") +
            (attempt.pass ? "" : ` (${attempt.failures[0]})`),
        );
      }
    }),
  );
}

const report = markdownReport(attempts);
console.log(report);
console.error(`results: ${path.relative(process.cwd(), path.resolve(out))}`);
if (args.report) await fs.writeFile(args.report, report);
