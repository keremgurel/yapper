import fs from "node:fs";
import path from "node:path";
import { judgeLine } from "./judge-line.mjs";
import { CONDITIONS, LONG_TAKE, TAKES } from "./takes.mjs";

// Reads the cut runs and says where the cut goes wrong: by transcriber, by
// recording condition, by accent and by the kind of mistake in the take.
//   node scripts/cut-testset/report.mjs <work folder> [tag]

const [work, tag = "r1"] = process.argv.slice(2);
const read = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const PROVIDERS = {
  "dg-nova3": "Deepgram Nova-3",
  "el-scribe2": "ElevenLabs Scribe",
};

/** The word indexes a run kept, from the model's `{"keep": [[a, b], ...]}` answer. */
function keptIndexes(answer, count) {
  const match = /\{.*\}/s.exec(answer ?? "");
  if (!match) return null;
  try {
    const kept = new Set();
    for (const [a, b] of JSON.parse(match[0]).keep ?? []) {
      for (let i = Math.max(0, a); i <= Math.min(count - 1, b); i += 1)
        kept.add(i);
    }
    return kept;
  } catch {
    return null;
  }
}

/** The planned segment a transcribed word belongs to, by where most of it falls. */
function segmentIndexOf(word, segments) {
  let best = -1;
  let bestOverlap = 0;
  segments.forEach((segment, index) => {
    const overlap =
      Math.min(word.end, segment.end) - Math.max(word.start, segment.start);
    if (overlap > bestOverlap) [best, bestOverlap] = [index, overlap];
  });
  return best;
}

const tally = () => ({
  runs: 0,
  perfect: 0,
  lines: 0,
  badLines: 0,
  unusable: 0,
});
const groups = { transcriber: {}, condition: {}, accent: {} };
const byPattern = {};
const byProblem = {};
const examples = new Map();

for (const take of [...TAKES, LONG_TAKE]) {
  const truth = read(path.join(work, "truth", `${take.id}.json`));
  for (const [provider, providerName] of Object.entries(PROVIDERS)) {
    const fixtureFile = path.join(
      work,
      "fixtures",
      `${take.id}.${provider}.json`,
    );
    const runFile = path.join(
      work,
      "cut",
      `${tag}.${take.id}.${provider}.jsonl`,
    );
    if (!fs.existsSync(fixtureFile) || !fs.existsSync(runFile)) continue;
    const { words } = read(fixtureFile);
    const owner = words.map((word) => segmentIndexOf(word, truth.segments));

    for (const row of fs
      .readFileSync(runFile, "utf8")
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line))) {
      const kept = row.valid ? keptIndexes(row.answer, words.length) : null;
      const keys = {
        transcriber: providerName,
        condition: CONDITIONS[take.condition].label,
        accent: take.accent,
      };
      const tallies = Object.entries(keys).map(
        ([group, key]) => (groups[group][key] ??= tally()),
      );
      for (const t of tallies) t.runs += 1;
      if (!kept) {
        for (const t of tallies) t.unusable += 1;
        continue;
      }
      const counted = truth.segments.map((segment) => ({
        ...segment,
        words: 0,
        kept: 0,
      }));
      owner.forEach((segment, index) => {
        if (segment < 0) return;
        counted[segment].words += 1;
        if (kept.has(index)) counted[segment].kept += 1;
      });

      let bad = 0;
      for (const line of new Set(counted.map((segment) => segment.line))) {
        const pieces = counted.filter((segment) => segment.line === line);
        const pattern = pieces[0].pattern;
        const verdict = judgeLine(pattern, pieces);
        const p = (byPattern[pattern] ??= { [providerName]: [0, 0] });
        const cell = (p[providerName] ??= [0, 0]);
        cell[1] += 1;
        if (verdict === "ok") continue;
        bad += 1;
        cell[0] += 1;
        byProblem[verdict] ??= {};
        byProblem[verdict][providerName] =
          (byProblem[verdict][providerName] ?? 0) + 1;
        const key = `${verdict} | ${providerName}`;
        if (!examples.has(key)) {
          const said = pieces
            .map((s) => `${s.kept}/${s.words} ${s.kind}`)
            .join(", ");
          examples.set(
            key,
            `${take.id}, "${pieces.at(-1).text.slice(0, 60)}" (${said})`,
          );
        }
      }
      for (const t of tallies) {
        t.lines += counted.reduce((set, s) => set.add(s.line), new Set()).size;
        t.badLines += bad;
        if (bad === 0) t.perfect += 1;
      }
    }
  }
}

const pct = (a, b) => `${Math.round((100 * a) / Math.max(1, b))}%`;
const table = (title, rows) => {
  console.log(`\n${title}`);
  console.log("| | Runs | Perfect cuts | Lines wrong | Unusable answers |");
  console.log("|---|---:|---:|---:|---:|");
  for (const [name, t] of Object.entries(rows)) {
    console.log(
      `| ${name} | ${t.runs} | ${t.perfect} (${pct(t.perfect, t.runs)}) | ${t.badLines} of ${t.lines} (${pct(t.badLines, t.lines)}) | ${t.unusable} |`,
    );
  }
};
table("By transcriber", groups.transcriber);
table("By recording condition", groups.condition);
table("By accent", groups.accent);

const names = Object.values(PROVIDERS);
console.log(
  `\nLines wrong by what the creator did\n| | ${names.join(" | ")} |\n|---|${names.map(() => "---:").join("|")}|`,
);
for (const [pattern, cells] of Object.entries(byPattern)) {
  console.log(
    `| ${pattern} | ${names.map((n) => (cells[n] ? `${cells[n][0]} of ${cells[n][1]}` : "")).join(" | ")} |`,
  );
}
console.log(
  `\nWhat went wrong\n| | ${names.join(" | ")} |\n|---|${names.map(() => "---:").join("|")}|`,
);
for (const [problem, cells] of Object.entries(byProblem)) {
  console.log(
    `| ${problem} | ${names.map((n) => cells[n] ?? 0).join(" | ")} |`,
  );
}
console.log("\nOne example of each");
for (const [key, example] of examples) console.log(`- ${key}: ${example}`);
