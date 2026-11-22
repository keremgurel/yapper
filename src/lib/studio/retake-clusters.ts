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

Keep the whole chosen delivery, including its attached opening words such as "And", "Now", or "So". These are not mistakes merely because the sentence can be understood without them.

Preserve every unique idea said only once. Do not shorten for style, remove ordinary filler, paraphrase, reorder, or delete a complete sentence merely because another sentence discusses the same topic. Remove only recorded mistakes and superseded attempts. Never delete every version of an idea.

Work through the entire transcript from left to right. Privately reconstruct the remaining transcript and verify that it is grammatical, contains one coherent version of each idea, retains the ending, and has no restart fragments. Then return ONLY JSON listing every surviving span in order:
{"keep":[[first,last],[first,last],...]}
All ranges are inclusive global word indices. List a span for every stretch of speech that stays, including passages with no retake in them; anything you leave out of the list is cut from the video.`;

type TimedWord = { text: string; start?: number; end?: number };

/** Mark a complete delivery immediately after a speaker abandons its opening
 * and starts again. The transcript alone can make this sound like a stutter
 * inside the final take. The editor still decides which ranges survive. */
function restartedDeliveries(words: TimedWord[]): string[] {
  const tokens = words.map(({ text }) =>
    text.toLowerCase().replace(/[^\p{L}\p{N}']/gu, ""),
  );
  const hints: string[] = [];
  const deliveries = new Map<string, { start: number; end: number }>();
  const finishes = (i: number) => /(?<!\.)[.!?]$/.test(words[i]!.text);
  for (let start = 4; start + 4 < words.length; start++) {
    const gap = (words[start]!.start ?? NaN) - (words[start - 1]!.end ?? NaN);
    if (!(gap >= 0.5) || finishes(start - 1)) continue;
    const opening = tokens.slice(start, start + 4);
    const matches = (i: number) =>
      opening.every((token, j) => token && token === tokens[i + j]);
    const earliestLead = Math.max(0, start - 10);
    let lead = start - 4;
    while (lead >= earliestLead && !matches(lead)) lead--;
    if (
      lead < earliestLead ||
      words.slice(lead, start).some((_, i) => finishes(lead + i))
    )
      continue;

    let end = start;
    while (end < words.length - 1 && end - start < 45 && !finishes(end)) {
      const pause = (words[end + 1]!.start ?? 0) - (words[end]!.end ?? 0);
      if (pause > 1.2 || matches(end + 1)) break;
      end++;
    }
    if (!finishes(end) || end - start < 5) continue;

    // Only draw attention to a competing *completed* delivery with the same
    // opening, ending and numbers. Leave ordinary repeated openers alone.
    const numbers = words
      .slice(start, end + 1)
      .map(({ text }) => text.replace(/[,.!?]+$/, ""))
      .filter((token) => /\d/.test(token));
    const signature = [...opening, tokens[end], ...numbers].join(" ");
    const earlier = deliveries.get(signature);
    if (
      earlier &&
      sharesWording(
        tokens.slice(earlier.start + 4, earlier.end),
        tokens.slice(start + 4, end),
      ) &&
      (words[start]!.start ?? Infinity) - (words[earlier.end]!.end ?? 0) <= 60
    ) {
      hints.push(
        `Earlier delivery ${earlier.start}-${earlier.end}; abandoned opening ${lead}-${start - 1}; final complete delivery ${start}-${end}.`,
      );
    }
    deliveries.set(signature, { start, end });
  }
  return hints;
}

// Shared opening and closing words alone regularly occur in lists of
// different ideas. Require most of the interior vocabulary to recur too.
function sharesWording(first: string[], second: string[]) {
  const a = new Set(first);
  const b = new Set(second);
  const shared = [...a].filter((token) => b.has(token)).length;
  return shared >= 2 && shared >= Math.max(a.size, b.size) * 0.6;
}

/** How the transcript is handed to the model. */
export function numberedTranscript(words: TimedWord[]): string {
  const hints = restartedDeliveries(words);
  const pauseThreshold = hints.length ? 0.5 : 0.75;
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
        if (pause >= pauseThreshold) parts.push(`[pause=${pause.toFixed(1)}s]`);
      }
    }
    parts.push(`${index}:${word.text}`);
  }
  const transcript = parts.join(" ");
  return hints.length
    ? `${transcript}\n\nReview these competing deliveries. Prefer the final complete delivery even when ASR mishears a name or a short connecting word there. Keep distinct ideas separately.\n${hints.join("\n")}`
    : transcript;
}
