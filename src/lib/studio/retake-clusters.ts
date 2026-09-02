/**
 * The retake pass, expressed as the edit decision itself rather than as prose
 * to be matched back afterwards.
 *
 * The model used to return a cleaned script, which then had to be aligned to
 * source words by text similarity. That step could not tell two attempts at one
 * line apart when both matched, so it picked the wrong occurrence, clipped
 * opening words, and dropped sentences the model had kept. Here the model
 * returns word indices, so there is nothing to align: the edit is what it said.
 *
 * The output is grouped by retake block on purpose. A block names the source
 * spans that survive alongside the ones it deletes. Several kept spans let a
 * clean opening and ending survive around a false start, while requiring at
 * least one survivor prevents deleting every version of an idea. Anything the
 * model does not put in a block is kept untouched.
 */

export const RETAKE_BLOCK_PROMPT = `You are making a jump-cut edit of a talking-head recording. The input is the exact transcript as global wordIndex:word tokens, with unnumbered [pause=Ns] markers where the recording has a meaningful pause. Pause markers are context, not words, and cannot be included in a range. Return source ranges to DELETE; you cannot rewrite words.

A RETAKE BLOCK is any nearby passage the speaker records more than once. It may be one phrase, one sentence, OR A SEQUENCE OF MULTIPLE SENTENCES. Attempts can be interleaved: the speaker may say old metrics, new metrics, then restart and say old metrics and new metrics again. Treat that as one block and keep one coherent delivery, not one independently chosen version of each sentence.

Keep the latest version that is fluent, semantically complete, contextually correct, and preserves the intended detail. A version is NOT clean if it contains a restarted or duplicated phrase, stutter, abandoned fragment, self-correction, wrong number, or obvious wrong-word transcription when a nearby clean version resolves it. If the latest version is defective, keep the latest earlier clean version. You may keep several non-adjacent source spans when that is the only way to preserve a clean opening and clean ending around a false start.

Never assemble one sentence from separate attempts. In particular, words that look grammatically continuous but have a long [pause=Ns] boundary may be the end of one attempt followed by the tail of another whose opening ASR missed. Keep one contiguous delivery of a repeated sentence; do not splice a prefix before such a pause to a suffix after it.

Preserve every unique idea said only once. Do not shorten for style, remove ordinary filler, paraphrase, reorder, or delete a complete sentence merely because another sentence discusses the same topic. Remove only recorded mistakes and superseded attempts. Never delete every version of an idea.

Work through the entire transcript from left to right. Privately reconstruct the remaining transcript and verify that it is grammatical, contains one coherent version of each idea, retains the ending, and has no restart fragments. Then return ONLY JSON:
{"blocks":[{"topic":"few words","keep":[[first,last],...],"drop":[[first,last],...]}]}
All ranges are inclusive global indices. Kept and dropped ranges must not overlap.`;

/** How the transcript is handed to the model. */
export function numberedTranscript(
  words: { text: string; start?: number; end?: number }[],
): string {
  const parts: string[] = [];
  for (let index = 0; index < words.length; index++) {
    const word = words[index]!;
    if (index > 0) {
      const previous = words[index - 1]!;
      if (
        typeof previous.end === "number" &&
        typeof word.start === "number" &&
        Number.isFinite(previous.end) &&
        Number.isFinite(word.start)
      ) {
        const pause = word.start - previous.end;
        if (pause >= 0.75) parts.push(`[pause=${pause.toFixed(1)}s]`);
      }
    }
    parts.push(`${index}:${word.text}`);
  }
  return parts.join(" ");
}

/**
 * No edit removes this much of a recording. A response that says otherwise has
 * misread the indices, and applying it would delete the video.
 */
const MOST_THAT_MAY_GO = 0.85;

function isSpan(value: unknown, wordCount: number): value is [number, number] {
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

function overlaps(a: [number, number], b: [number, number]): boolean {
  return a[0] <= b[1] && b[0] <= a[1];
}

/**
 * The deletions a response asks for, or null when it cannot be trusted.
 *
 * Fails closed rather than applying the sound part of a bad answer. A partial
 * edit reads to the creator as a successful one that happened to delete their
 * ending.
 */
export function retakeCutsFromResponse(
  text: string,
  wordCount: number,
): [number, number][] | null {
  const json = text.match(/\{[\s\S]*\}/);
  if (!json) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(json[0]);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const blocks = (parsed as { blocks?: unknown }).blocks;
  if (!Array.isArray(blocks)) return null;

  const keeps: [number, number][] = [];
  const drops: [number, number][] = [];
  for (const entry of blocks) {
    if (!entry || typeof entry !== "object") return null;
    const { keep, drop } = entry as { keep?: unknown; drop?: unknown };
    if (
      !Array.isArray(keep) ||
      keep.length === 0 ||
      !keep.every((span) => isSpan(span, wordCount))
    ) {
      return null;
    }
    if (!Array.isArray(drop)) return null;
    const cluster: [number, number][] = [];
    for (const span of drop) {
      if (!isSpan(span, wordCount)) return null;
      cluster.push(span);
    }
    // A cluster that deletes its own survivor is self-contradictory, and one
    // whose deletions sit somewhere else in the recording has lost track of the
    // indices. Either way the response is not an edit of this transcript.
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
  // Nothing one cluster keeps may be deleted by another.
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
