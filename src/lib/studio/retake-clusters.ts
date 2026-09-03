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
 * The contract is keep only. An earlier version asked for blocks that each
 * named the spans to keep and the spans to drop, and the validator refused any
 * answer where the two disagreed. Measured on a real take (2026-09-03,
 * `docs/one-click-benchmark-review.md` Part 2), that contract made the
 * production model fail every run and made a stronger, faster model fail half
 * of them, always on a contradiction between a keep and a drop. Asking only for
 * what survives leaves nothing in the answer that can contradict itself, cut
 * the answer to a quarter of its size, and raised the worst run's score.
 * Everything outside a kept span is deleted; see `retake-keep-spans.ts` for
 * how the answer is read.
 */

export const RETAKE_PROMPT = `You are making a jump-cut edit of a talking-head recording. The input is the exact transcript as global wordIndex:word tokens, with unnumbered [pause=Ns] markers where the recording has a meaningful pause. Pause markers are context, not words, and cannot be included in a range. Return the source ranges to KEEP; every word not inside a kept range is deleted; you cannot rewrite words.

A RETAKE BLOCK is any nearby passage the speaker records more than once. It may be one phrase, one sentence, OR A SEQUENCE OF MULTIPLE SENTENCES. Attempts can be interleaved: the speaker may say old metrics, new metrics, then restart and say old metrics and new metrics again. Treat that as one block and keep one coherent delivery, not one independently chosen version of each sentence.

Keep the latest version that is fluent, semantically complete, contextually correct, and preserves the intended detail. A version is NOT clean if it contains a restarted or duplicated phrase, stutter, abandoned fragment, self-correction, wrong number, or obvious wrong-word transcription when a nearby clean version resolves it. If the latest version is defective, keep the latest earlier clean version. You may keep several non-adjacent source spans when that is the only way to preserve a clean opening and clean ending around a false start.

Never assemble one sentence from separate attempts. In particular, words that look grammatically continuous but have a long [pause=Ns] boundary may be the end of one attempt followed by the tail of another whose opening ASR missed. Keep one contiguous delivery of a repeated sentence; do not splice a prefix before such a pause to a suffix after it.

Preserve every unique idea said only once. Do not shorten for style, remove ordinary filler, paraphrase, reorder, or delete a complete sentence merely because another sentence discusses the same topic. Remove only recorded mistakes and superseded attempts. Never delete every version of an idea.

Work through the entire transcript from left to right. Privately reconstruct the remaining transcript and verify that it is grammatical, contains one coherent version of each idea, retains the ending, and has no restart fragments. Then return ONLY JSON listing every surviving span in order:
{"keep":[[first,last],[first,last],...]}
All ranges are inclusive global word indices. List a span for every stretch of speech that stays, including passages with no retake in them; anything you leave out of the list is cut from the video.`;

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
