import fs from "node:fs/promises";
import path from "node:path";
import { runAttempt } from "./attempt.mjs";
import { loadFixture } from "./fixture.mjs";
import { markdownTable, summarize } from "./report.mjs";
import { settledByRequestId } from "./surplus.mjs";
import { pickVariants } from "./variants.mjs";

/**
 * 1-Click retake cleaner evaluation.
 *
 *   node --experimental-strip-types --no-warnings scripts/clean-eval/run.mjs \
 *     --fixture path.json --models a,b --variants baseline,all --runs 2 \
 *     --concurrency 6 --out results.jsonl [--dry]
 *
 * Every attempt is appended to the JSONL as it finishes, so a killed run keeps
 * what it measured. Settled cost is read from /v1/buyer/me after each batch
 * of at most eight attempts, because that endpoint only returns the last
 * twenty settled requests.
 */
const args = Object.fromEntries(
  process.argv
    .slice(2)
    .map((arg, i, all) =>
      arg.startsWith("--")
        ? [
            arg.slice(2),
            all[i + 1]?.startsWith("--") || all[i + 1] === undefined
              ? "true"
              : all[i + 1],
          ]
        : [],
    )
    .filter((pair) => pair.length),
);

const fixture = await loadFixture(args.fixture);
const models = (args.models ?? "").split(",").filter(Boolean);
const variants = pickVariants((args.variants ?? "baseline").split(","));
const runs = Number(args.runs ?? 1);
const concurrency = Number(args.concurrency ?? 6);
const out = args.out ?? "clean-eval-results.jsonl";
if (models.length === 0) throw new Error("--models is required");

const jobs = [];
for (const model of models)
  for (const variant of variants)
    for (let run = 1; run <= runs; run++) jobs.push({ model, variant, run });

console.error(
  `${fixture.name}: ${fixture.words.length} words, ${fixture.expectedDrop.size} expected deletions` +
    (fixture.energy ? ", energy markers available" : ", no energy markers") +
    `\n${jobs.length} attempts across ${models.length} models × ${variants.length} variants × ${runs} runs`,
);

if (args.dry === "true") {
  const { buildMessages } = await import("./prompts.mjs");
  for (const variant of variants) {
    const [system, user] = buildMessages(fixture, variant);
    console.log(
      `\n=== ${variant.name}: system ${system.content.length} chars, user ${user.content.length} chars`,
    );
    console.log(user.content.slice(0, 600));
  }
  process.exit(0);
}

await fs.mkdir(path.dirname(path.resolve(out)), { recursive: true });
const results = [];
const batchSize = 8;
for (let offset = 0; offset < jobs.length; offset += batchSize) {
  const batch = jobs.slice(offset, offset + batchSize);
  const batchResults = [];
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, batch.length) }, async () => {
      while (next < batch.length) {
        const job = batch[next++];
        let result;
        try {
          result = await runAttempt({ ...job, fixture });
        } catch (error) {
          result = {
            model: job.model,
            variant: job.variant.name,
            run: job.run,
            valid: false,
            error: error.message,
            elapsedMs: 0,
            usage: {
              prompt_tokens: 0,
              completion_tokens: 0,
              reasoning_tokens: 0,
            },
            requestIds: [],
            rejection: [error.message],
          };
        }
        batchResults.push(result);
        console.error(
          `${result.model} ${result.variant} #${result.run}: ${result.valid ? "valid" : "REJECTED"}` +
            (result.f1 != null
              ? ` f1=${result.f1} wrong=${result.wrongDeletions} left=${result.mistakesLeft}`
              : "") +
            ` ${(result.elapsedMs / 1000).toFixed(1)}s` +
            (result.error ? ` error=${result.error}` : ""),
        );
      }
    }),
  );
  // Settlement lands a little after the response; give it a moment.
  await new Promise((resolve) => setTimeout(resolve, 4_000));
  const settled = await settledByRequestId().catch(() => new Map());
  for (const result of batchResults) {
    const rows = (result.requestIds ?? [])
      .map((id) => settled.get(id))
      .filter(Boolean);
    if (rows.length === result.requestIds?.length && rows.length > 0) {
      result.settledUsd = rows.reduce((sum, r) => sum + r.settledUsd, 0);
      result.directUsd = rows.reduce((sum, r) => sum + r.directUsd, 0);
    }
    results.push(result);
    await fs.appendFile(out, JSON.stringify(result) + "\n");
  }
}

console.log(markdownTable(summarize(results)));
