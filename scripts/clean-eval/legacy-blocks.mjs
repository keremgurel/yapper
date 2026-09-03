/**
 * The contract production used until 2026-09-03: blocks of keep and drop
 * spans, refused whole on any contradiction. Kept here so the harness can keep
 * measuring the old contract against the keep only one that replaced it.
 */

export const LEGACY_BLOCK_PROMPT = `You are making a jump-cut edit of a talking-head recording. The input is the exact transcript as global wordIndex:word tokens, with unnumbered [pause=Ns] markers where the recording has a meaningful pause. Pause markers are context, not words, and cannot be included in a range. Return source ranges to DELETE; you cannot rewrite words.

A RETAKE BLOCK is any nearby passage the speaker records more than once. It may be one phrase, one sentence, OR A SEQUENCE OF MULTIPLE SENTENCES. Attempts can be interleaved: the speaker may say old metrics, new metrics, then restart and say old metrics and new metrics again. Treat that as one block and keep one coherent delivery, not one independently chosen version of each sentence.

Keep the latest version that is fluent, semantically complete, contextually correct, and preserves the intended detail. A version is NOT clean if it contains a restarted or duplicated phrase, stutter, abandoned fragment, self-correction, wrong number, or obvious wrong-word transcription when a nearby clean version resolves it. If the latest version is defective, keep the latest earlier clean version. You may keep several non-adjacent source spans when that is the only way to preserve a clean opening and clean ending around a false start.

Never assemble one sentence from separate attempts. In particular, words that look grammatically continuous but have a long [pause=Ns] boundary may be the end of one attempt followed by the tail of another whose opening ASR missed. Keep one contiguous delivery of a repeated sentence; do not splice a prefix before such a pause to a suffix after it.

Preserve every unique idea said only once. Do not shorten for style, remove ordinary filler, paraphrase, reorder, or delete a complete sentence merely because another sentence discusses the same topic. Remove only recorded mistakes and superseded attempts. Never delete every version of an idea.

Work through the entire transcript from left to right. Privately reconstruct the remaining transcript and verify that it is grammatical, contains one coherent version of each idea, retains the ending, and has no restart fragments. Then return ONLY JSON:
{"blocks":[{"topic":"few words","keep":[[first,last],...],"drop":[[first,last],...]}]}
All ranges are inclusive global indices. Kept and dropped ranges must not overlap.`;

const MOST_THAT_MAY_GO = 0.85;

function isSpan(value, wordCount) {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    Number.isInteger(value[0]) &&
    Number.isInteger(value[1]) &&
    value[0] >= 0 &&
    value[1] < wordCount &&
    value[0] <= value[1]
  );
}

function overlaps(a, b) {
  return a[0] <= b[1] && b[0] <= a[1];
}

/** The old validator, verbatim in behaviour: any contradiction returns null. */
export function legacyBlockCuts(text, wordCount) {
  const json = text.match(/\{[\s\S]*\}/);
  if (!json) return null;
  let parsed;
  try {
    parsed = JSON.parse(json[0]);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const blocks = parsed.blocks;
  if (!Array.isArray(blocks)) return null;

  const keeps = [];
  const drops = [];
  for (const entry of blocks) {
    if (!entry || typeof entry !== "object") return null;
    const { keep, drop } = entry;
    if (
      !Array.isArray(keep) ||
      keep.length === 0 ||
      !keep.every((span) => isSpan(span, wordCount))
    ) {
      return null;
    }
    if (!Array.isArray(drop)) return null;
    const cluster = [];
    for (const span of drop) {
      if (!isSpan(span, wordCount)) return null;
      cluster.push(span);
    }
    if (cluster.some((span) => keep.some((kept) => overlaps(span, kept)))) {
      return null;
    }
    keeps.push(...keep);
    drops.push(...cluster);
  }

  drops.sort((a, b) => a[0] - b[0]);
  for (let index = 1; index < drops.length; index++) {
    if (overlaps(drops[index - 1], drops[index])) return null;
  }
  if (drops.some((span) => keeps.some((kept) => overlaps(span, kept)))) {
    return null;
  }
  const removed = drops.reduce(
    (sum, [start, end]) => sum + (end - start + 1),
    0,
  );
  if (removed > wordCount * MOST_THAT_MAY_GO) return null;
  return drops;
}
