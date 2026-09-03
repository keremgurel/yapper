import fs from "node:fs/promises";
import { cutsFromKeptSpans } from "../../src/lib/studio/retake-keep-spans.ts";
import { legacyBlockCuts } from "./legacy-blocks.mjs";
import { loadFixture } from "./fixture.mjs";
import { lenientBlockCuts } from "./normalize.mjs";
import { markdownTable, summarize } from "./report.mjs";
import { scoreCuts } from "./score.mjs";
import { LEGACY_RESULT_NAMES, VARIANTS } from "./variants.mjs";

/**
 * Re-read saved answers against a (possibly corrected) fixture without
 * spending anything. Every attempt keeps its raw answer, so a ground truth fix
 * or a new reader can be applied to past runs.
 *
 *   node --experimental-strip-types --no-warnings scripts/clean-eval/rescore.mjs \
 *     --fixture fixture.json results1.jsonl [results2.jsonl ...]
 */
const argv = process.argv.slice(2);
const fixtureIndex = argv.indexOf("--fixture");
if (fixtureIndex < 0) throw new Error("--fixture is required");
const fixture = await loadFixture(argv[fixtureIndex + 1]);
const files = argv.filter(
  (a, i) => i !== fixtureIndex && i !== fixtureIndex + 1,
);
const wordCount = fixture.words.length;

const attempts = [];
for (const file of files) {
  const lines = (await fs.readFile(file, "utf8")).split("\n").filter(Boolean);
  for (const line of lines) {
    const row = JSON.parse(line);
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
    const scored = cuts ? scoreCuts(cuts, fixture) : {};
    attempts.push({
      ...row,
      valid: cuts !== null,
      f1: scored.f1,
      wrongDeletions: scored.wrongDeletions,
      mistakesLeft: scored.mistakesLeft,
      removedWords: scored.removedWords,
    });
  }
}
console.log(markdownTable(summarize(attempts)));
