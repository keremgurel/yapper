import fs from "node:fs/promises";
import process from "node:process";

const projectPath = process.argv[2];
const models = process.argv.slice(3);
if (!projectPath || models.length === 0) {
  throw new Error("Usage: evaluate-clean-models.mjs <project.json> <model...>");
}

const key = process.env.SURPLUS_API_KEY;
if (!key) throw new Error("SURPLUS_API_KEY is required");
const base = (
  process.env.SURPLUS_API_BASE ?? "https://api.surplusintelligence.ai/v1"
).replace(/\/$/, "");
const project = JSON.parse(await fs.readFile(projectPath, "utf8"));
const words = project.transcript;
if (!Array.isArray(words) || words.length !== 1407) {
  throw new Error("This scored fixture expects the 1,407-word real take");
}

// Hand-audited final delivery. Separate spans are intentional: the speaker can
// finish a thought cleanly after a false start without rerecording its opening.
const keptSpans = [
  [43, 50],
  [68, 82],
  [123, 135],
  [168, 178],
  [219, 228],
  [375, 388],
  [405, 417],
  [460, 489],
  [504, 540],
  [612, 627],
  [700, 715],
  [770, 799],
  [820, 821],
  [826, 846],
  [884, 897],
  [924, 948],
  [1045, 1065],
  [1105, 1117],
  [1130, 1134],
  [1170, 1202],
  [1333, 1349],
  [1358, 1379],
  [1391, 1406],
];
const expectedKeep = new Set(
  keptSpans.flatMap(([start, end]) =>
    Array.from({ length: end - start + 1 }, (_, offset) => start + offset),
  ),
);
const expectedDrop = new Set(
  words.map((_, index) => index).filter((index) => !expectedKeep.has(index)),
);

const prompt = `You are making a jump-cut edit of a talking-head recording. The input is the exact transcript as global wordIndex:word tokens. Return source ranges to DELETE; you cannot rewrite words.

A RETAKE BLOCK is any nearby passage the speaker records more than once. It may be one phrase, one sentence, OR A SEQUENCE OF MULTIPLE SENTENCES. Attempts can be interleaved: the speaker may say old metrics, new metrics, then restart and say old metrics and new metrics again. Treat that as one block and keep one coherent delivery, not one independently chosen version of each sentence.

Keep the latest version that is fluent, semantically complete, contextually correct, and preserves the intended detail. A version is NOT clean if it contains a restarted or duplicated phrase, stutter, abandoned fragment, self-correction, wrong number, or obvious wrong-word transcription when a nearby clean version resolves it. If the latest version is defective, keep the latest earlier clean version. You may keep several non-adjacent source spans when that is the only way to preserve a clean opening and clean ending around a false start.

Preserve every unique idea said only once. Do not shorten for style, remove ordinary filler, paraphrase, reorder, or delete a complete sentence merely because another sentence discusses the same topic. Remove only recorded mistakes and superseded attempts. Never delete every version of an idea.

Work through the entire transcript from left to right. Privately reconstruct the remaining transcript and verify that it is grammatical, contains one coherent version of each idea, retains the ending, and has no restart fragments. Then return ONLY JSON:
{"blocks":[{"topic":"few words","keep":[[first,last],...],"drop":[[first,last],...]}]}
All ranges are inclusive global indices. Kept and dropped ranges must not overlap.`;

function isSpan(value) {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    Number.isInteger(value[0]) &&
    Number.isInteger(value[1]) &&
    value[0] >= 0 &&
    value[0] <= value[1] &&
    value[1] < words.length
  );
}

function parse(answer) {
  const match = answer.match(/\{[\s\S]*\}/);
  if (!match) return null;
  let blocks;
  try {
    blocks = JSON.parse(match[0]).blocks;
  } catch {
    return null;
  }
  if (!Array.isArray(blocks)) return null;
  const keeps = [];
  const cuts = [];
  for (const block of blocks) {
    if (!block || !Array.isArray(block.keep) || !Array.isArray(block.drop))
      return null;
    if (!block.keep.every(isSpan) || !block.drop.every(isSpan)) return null;
    keeps.push(...block.keep);
    cuts.push(...block.drop);
  }
  cuts.sort((a, b) => a[0] - b[0]);
  if (cuts.some(([start], index) => index > 0 && start <= cuts[index - 1][1]))
    return null;
  if (
    cuts.some(([start, end]) =>
      keeps.some(([ks, ke]) => start <= ke && ks <= end),
    )
  )
    return null;
  return cuts;
}

function score(cuts) {
  const predicted = new Set(
    cuts.flatMap(([start, end]) =>
      Array.from({ length: end - start + 1 }, (_, offset) => start + offset),
    ),
  );
  const tp = [...predicted].filter((index) => expectedDrop.has(index)).length;
  const fp = [...predicted].filter((index) => expectedKeep.has(index)).length;
  const fn = [...expectedDrop].filter((index) => !predicted.has(index)).length;
  const precision = tp / Math.max(1, tp + fp);
  const recall = tp / Math.max(1, tp + fn);
  return {
    precision: Number(precision.toFixed(4)),
    recall: Number(recall.toFixed(4)),
    f1: Number(
      (
        (2 * precision * recall) /
        Math.max(Number.EPSILON, precision + recall)
      ).toFixed(4),
    ),
    wrongDeletions: fp,
    mistakesLeft: fn,
    removedWords: predicted.size,
  };
}

const transcript = words.map(({ text }, index) => `${index}:${text}`).join(" ");
const timeoutMs = Number(process.env.BENCHMARK_TIMEOUT_MS ?? 2_000_000);
const results = await Promise.all(
  models.map(async (model) => {
    const started = performance.now();
    try {
      const response = await fetch(`${base}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          temperature: 0,
          max_completion_tokens: 16_000,
          messages: [
            { role: "system", content: prompt },
            { role: "user", content: transcript },
          ],
        }),
        signal: AbortSignal.timeout(timeoutMs),
      });
      const data = await response.json();
      const answer = data.choices?.[0]?.message?.content ?? "";
      const cuts = parse(answer);
      return {
        model,
        elapsedSeconds: Number(
          ((performance.now() - started) / 1000).toFixed(1),
        ),
        status: response.status,
        finishReason: data.choices?.[0]?.finish_reason ?? null,
        usage: data.usage ?? null,
        providerError: data.error ?? null,
        parseable: cuts !== null,
        ...(cuts ? score(cuts) : {}),
        ...(process.env.BENCHMARK_INCLUDE_ANSWERS === "1" ? { answer } : {}),
      };
    } catch (error) {
      return {
        model,
        elapsedSeconds: Number(
          ((performance.now() - started) / 1000).toFixed(1),
        ),
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }),
);

console.log(
  JSON.stringify(
    {
      wordCount: words.length,
      expectedRemovedWords: expectedDrop.size,
      results,
    },
    null,
    2,
  ),
);
