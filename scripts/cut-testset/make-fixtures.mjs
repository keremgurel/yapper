import fs from "node:fs";
import path from "node:path";
import { LONG_TAKE, TAKES } from "./takes.mjs";

// Turns each transcript into a scored fixture for scripts/clean-eval: the words
// the edit model will see, and which of them the answer key keeps.
//   node scripts/cut-testset/make-fixtures.mjs <work folder> <provider> [provider ...]

const [work, ...providers] = process.argv.slice(2);

/** A word is kept when at least 35% of it falls inside a kept clip, the rule scripts/asr-eval uses. */
function keptSpans(words, clips) {
  const spans = [];
  words.forEach((word, index) => {
    const length = Math.max(1e-6, word.end - word.start);
    const inside = clips.reduce(
      (sum, [start, end]) =>
        sum +
        Math.max(0, Math.min(word.end, end) - Math.max(word.start, start)),
      0,
    );
    if (inside / length < 0.35) return;
    const last = spans.at(-1);
    if (last && last[1] === index - 1) last[1] = index;
    else spans.push([index, index]);
  });
  return spans;
}

// Real takes added with add-project.mjs also get a fixture from the app's own
// transcript, which is what the edit model saw when the video was made.
const realFile = path.join(work, "real-takes.txt");
const real = fs.existsSync(realFile)
  ? fs
      .readFileSync(realFile, "utf8")
      .split("\n")
      .filter(Boolean)
      .map((id) => ({ id, real: true }))
  : [];

for (const take of [...TAKES, LONG_TAKE, ...real]) {
  const { clips } = JSON.parse(
    fs.readFileSync(
      path.join(work, "fixtures", `${take.id}.project.json`),
      "utf8",
    ),
  );
  for (const provider of take.real ? ["app", ...providers] : providers) {
    const file =
      provider === "app"
        ? path.join(work, "fixtures", `${take.id}.project.json`)
        : path.join(work, "asr", `${take.id}.${provider}.json`);
    if (!fs.existsSync(file)) continue;
    const words = JSON.parse(fs.readFileSync(file, "utf8")).words.map(
      (word) => ({
        text: word.text.trim(),
        start: word.start,
        end: word.end,
      }),
    );
    fs.writeFileSync(
      path.join(work, "fixtures", `${take.id}.${provider}.json`),
      JSON.stringify({
        source: `${take.id}.${provider}`,
        words,
        keptSpans: keptSpans(words, clips),
        clips,
      }),
    );
  }
}
console.log("fixtures written");
