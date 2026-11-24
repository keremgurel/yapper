import fs from "node:fs";
import path from "node:path";

// For real takes: lists the exact words each run cut that the finished edit
// kept, and the words it left in that the finished edit removed, with where
// they are in the recording. This is the list to read for stray mumbles.
//   node scripts/cut-testset/report-real.mjs <work folder> <tag>

const [work, tag] = process.argv.slice(2);
const clock = (s) =>
  `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

/** Neighbouring word indexes as phrases, so a left-in mumble reads as one thing. */
function phrases(indexes, words) {
  const runs = [];
  for (const index of indexes) {
    const last = runs.at(-1);
    if (last && last.at(-1) === index - 1) last.push(index);
    else runs.push([index]);
  }
  return runs.map(
    (run) =>
      `${clock(words[run[0]].start)} "${run.map((i) => words[i].text).join(" ")}"`,
  );
}

for (const file of fs
  .readdirSync(path.join(work, "cut"))
  .filter((f) => f.startsWith(`${tag}.`))
  .sort()) {
  const name = file.slice(tag.length + 1, -".jsonl".length);
  const fixture = JSON.parse(
    fs.readFileSync(path.join(work, "fixtures", `${name}.json`), "utf8"),
  );
  const expected = new Set(
    fixture.keptSpans.flatMap(([a, b]) =>
      Array.from({ length: b - a + 1 }, (_, i) => a + i),
    ),
  );
  const rows = fs
    .readFileSync(path.join(work, "cut", file), "utf8")
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
  console.log(`\n${name}`);
  rows.forEach((row, run) => {
    const match = row.valid ? /\{.*\}/s.exec(row.answer ?? "") : null;
    if (!match) return console.log(`  run ${run + 1}: no usable answer`);
    const kept = new Set(
      JSON.parse(match[0]).keep.flatMap(([a, b]) =>
        Array.from({ length: b - a + 1 }, (_, i) => a + i),
      ),
    );
    const all = fixture.words.map((_, index) => index);
    const wrong = phrases(
      all.filter((i) => expected.has(i) && !kept.has(i)),
      fixture.words,
    );
    const left = phrases(
      all.filter((i) => !expected.has(i) && kept.has(i)),
      fixture.words,
    );
    console.log(
      `  run ${run + 1}: ${wrong.length} wrongly cut, ${left.length} left in`,
    );
    for (const phrase of wrong) console.log(`    cut      ${phrase}`);
    for (const phrase of left) console.log(`    left in  ${phrase}`);
  });
}
