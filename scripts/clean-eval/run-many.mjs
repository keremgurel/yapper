import fs from "node:fs/promises";
import path from "node:path";
import { runAttempt } from "./attempt.mjs";
import { loadFixture } from "./fixture.mjs";
import { pickVariants } from "./variants.mjs";

/**
 * Many fixtures at once, one JSONL per fixture.
 *
 *   node --experimental-strip-types --no-warnings scripts/clean-eval/run-many.mjs \
 *     --fixtures a.json,b.json --models x,y --variants baseline --runs 2 \
 *     --concurrency 16 --timeout 120 --outdir results --tag r1
 *
 * run.mjs waits for the slowest call in each batch of eight, so one model that
 * takes minutes holds up the rest. This runs a single pool across every
 * fixture and gives up on an attempt after --timeout seconds, recording it as
 * a failure. It does not read settled cost; compare /v1/buyer/me before and
 * after a run for that.
 */
const args = Object.fromEntries(
  process.argv
    .slice(2)
    .flatMap((arg, i, all) =>
      arg.startsWith("--") ? [[arg.slice(2), all[i + 1] ?? "true"]] : [],
    ),
);
const fixtures = await Promise.all(
  args.fixtures.split(",").map(async (file) => ({
    file,
    fixture: await loadFixture(file),
  })),
);
const models = args.models.split(",").filter(Boolean);
const variants = pickVariants((args.variants ?? "baseline").split(","));
const runs = Number(args.runs ?? 1);
const timeoutMs = Number(args.timeout ?? 120) * 1000;
const outdir = args.outdir ?? ".";
const tag = args.tag ?? "run";
await fs.mkdir(outdir, { recursive: true });

const jobs = [];
for (let run = 1; run <= runs; run++)
  for (const { file, fixture } of fixtures)
    for (const model of models)
      for (const variant of variants)
        jobs.push({ file, fixture, model, variant, run });

let next = 0;
let done = 0;
await Promise.all(
  Array.from({ length: Number(args.concurrency ?? 16) }, async () => {
    while (next < jobs.length) {
      const job = jobs[next++];
      const started = performance.now();
      let timer;
      const result = await Promise.race([
        runAttempt(job).catch((error) => ({ failed: error.message })),
        new Promise((resolve) => {
          timer = setTimeout(() => resolve({ failed: "timeout" }), timeoutMs);
        }),
      ]);
      clearTimeout(timer);
      const row = result.failed
        ? {
            model: job.model,
            variant: job.variant.name,
            run: job.run,
            valid: false,
            error: result.failed,
            elapsedMs: Math.round(performance.now() - started),
            usage: {
              prompt_tokens: 0,
              completion_tokens: 0,
              reasoning_tokens: 0,
            },
          }
        : result;
      const name = path.basename(job.file).replace(/\.json$/, "");
      await fs.appendFile(
        path.join(outdir, `${tag}.${name}.jsonl`),
        JSON.stringify(row) + "\n",
      );
      done++;
      console.error(
        `[${done}/${jobs.length}] ${name} ${row.model} ${row.variant} #${row.run}: ` +
          (row.valid
            ? `f1=${row.f1} wrong=${row.wrongDeletions} left=${row.mistakesLeft}`
            : `FAILED ${row.error ?? "rejected"}`) +
          ` ${(row.elapsedMs / 1000).toFixed(1)}s`,
      );
    }
  }),
);
process.exit(0);
