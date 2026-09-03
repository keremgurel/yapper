import fs from "node:fs/promises";
import { cutsFromKeptSpans } from "../../src/lib/studio/retake-keep-spans.ts";
import { legacyBlockCuts } from "./legacy-blocks.mjs";
import { loadFixture } from "./fixture.mjs";
import { lenientBlockCuts } from "./normalize.mjs";
import { LEGACY_RESULT_NAMES, VARIANTS } from "./variants.mjs";

/**
 * Show where a saved attempt disagrees with the human edit, as words.
 *
 *   node --experimental-strip-types --no-warnings scripts/clean-eval/diff.mjs \
 *     --fixture f.json --results r.jsonl --model gemini-3.7-flash --variant keeponly [--run 1]
 */
const argv = process.argv.slice(2);
const arg = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
};
const fixture = await loadFixture(arg("fixture"));
const wordCount = fixture.words.length;
const rows = (await fs.readFile(arg("results"), "utf8"))
  .split("\n")
  .filter(Boolean)
  .map((l) => JSON.parse(l))
  .filter(
    (r) =>
      r.model === arg("model") &&
      r.variant === arg("variant") &&
      (arg("run") === undefined || String(r.run) === arg("run")),
  );

const runs = (indices) => {
  const out = [];
  let run = [];
  for (const i of indices) {
    if (run.length && i !== run[run.length - 1] + 1) {
      out.push(run);
      run = [];
    }
    run.push(i);
  }
  if (run.length) out.push(run);
  return out.map(
    (r) =>
      `[${r[0]}-${r[r.length - 1]}] "${r.map((i) => fixture.words[i].text).join(" ")}"`,
  );
};

for (const row of rows) {
  const variant =
    VARIANTS[LEGACY_RESULT_NAMES[row.variant] ?? row.variant] ?? {};
  let cuts = null;
  if (row.answer) {
    if (variant.contract === "keep")
      cuts = cutsFromKeptSpans(row.answer, wordCount);
    else if (variant.lenient)
      cuts = lenientBlockCuts(row.answer, wordCount).cuts;
    else cuts = legacyBlockCuts(row.answer, wordCount);
  }
  console.log(`\n### ${row.model} ${row.variant} #${row.run}`);
  if (!cuts) {
    console.log("rejected:", JSON.stringify(row.rejection));
    continue;
  }
  const dropped = new Set(
    cuts.flatMap(([a, b]) =>
      Array.from({ length: b - a + 1 }, (_, i) => a + i),
    ),
  );
  const wrong = [...fixture.expectedKeep].filter((i) => dropped.has(i));
  const left = [...fixture.expectedDrop].filter((i) => !dropped.has(i));
  console.log(
    `WRONGLY DELETED (${wrong.length}):\n  ` + runs(wrong).join("\n  "),
  );
  console.log(`LEFT IN (${left.length}):\n  ` + runs(left).join("\n  "));
}
