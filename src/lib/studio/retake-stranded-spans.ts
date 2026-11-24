/**
 * A sentence left behind by a retake.
 *
 * The speaker says a line, adds a short sentence after it, then goes back and
 * records the line again. The model keeps the second delivery of the line, as
 * it should, and also keeps the short sentence, because it was only said once.
 * In the cut that sentence now plays before the line it was said after. Seen
 * on a 24.6 minute take (2026-11-23): a line giving a figure, then a four
 * word sentence about it, then a false start and the line again. Every run
 * kept the four words in front of the retake, and the creator's own edit had
 * removed them.
 *
 * Going back to the line is the speaker abandoning what followed it. Had they
 * wanted the sentence, they would have said it again after the retake, and
 * then the model has a later delivery to keep.
 *
 * The test is narrow on purpose, and each condition is there because real
 * edits broke a looser one:
 *
 * - The sentence is a whole kept span, cut on both sides. A sentence that runs
 *   straight into the retake is far more often the new opening of a passage
 *   recorded again from the top.
 * - It was not said before. When it was, it is the first sentence of such a
 *   passage, and the cut before it holds its earlier delivery.
 * - It is short and ends a sentence. Losing a longer stretch would cost more
 *   than hearing it out of order, and words that trail into the retake may be
 *   a new lead-in to it.
 *
 * Checked on 2026-11-23 against 59 answer keys (the synthetic test set on two
 * transcribers, and real takes) and nine finished projects: it fired on none
 * of them. On 107 saved model answers it fired only on the sentence above.
 */

type Word = { text: string };
type Span = [number, number];

/** A stranded sentence is short. Anything longer is content. */
const LONGEST_STRANDED = 12;
/** How many opening words two deliveries of one line must share, in order. */
const OPENING = 4;
/** How far back the dropped delivery may begin: one spoken line. */
const LONGEST_LINE = 40;
/** How far back to look for an earlier delivery of the sentence itself. */
const FARTHEST_EARLIER_DELIVERY = 200;
/** Slack for a retake that words the line a little longer. */
const REWORDING_ROOM = 3;

function token(word: Word): string {
  return word.text.toLowerCase().replace(/[^\p{L}\p{N}']/gu, "");
}

/** Ends a sentence. A trailing "..." is a thought left hanging, so it does not. */
function finishes(word: Word): boolean {
  return /(?<!\.)[.!?]$/.test(word.text);
}

function keptSpans(cuts: Span[], wordCount: number): Span[] {
  const kept: Span[] = [];
  let cursor = 0;
  for (const [start, end] of [...cuts].sort((a, b) => a[0] - b[0])) {
    if (start > cursor) kept.push([cursor, start - 1]);
    cursor = Math.max(cursor, end + 1);
  }
  if (cursor <= wordCount - 1) kept.push([cursor, wordCount - 1]);
  return kept;
}

/**
 * Shared opening words alone start plenty of different sentences. Most of the
 * rest of the line has to come back too.
 */
function sharesWording(first: string[], second: string[]): boolean {
  const a = new Set(first.filter(Boolean));
  const b = new Set(second.filter(Boolean));
  const shared = [...a].filter((word) => b.has(word)).length;
  return shared >= 2 && shared >= Math.max(a.size, b.size) * 0.6;
}

/**
 * Whether any two neighbouring words of the sentence were already said, in
 * that order, in the cut before it.
 */
function saidBefore(
  tokens: string[],
  cutStart: number,
  [start, end]: Span,
): boolean {
  const from = Math.max(cutStart, start - FARTHEST_EARLIER_DELIVERY);
  for (let i = start; i < end; i++) {
    for (let j = from; j + 1 < start; j++) {
      if (tokens[j] === tokens[i] && tokens[j + 1] === tokens[i + 1]) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Whether the kept span `retake` opens with a second delivery of a line that
 * was dropped in the cut ending just before `sentence`.
 */
function retakesDroppedLine(
  tokens: string[],
  cutStart: number,
  sentence: number,
  [retake, retakeEnd]: Span,
): boolean {
  const opening = tokens.slice(retake, retake + OPENING);
  if (opening.length < OPENING || opening.some((word) => !word)) return false;

  const earliest = Math.max(cutStart, sentence - LONGEST_LINE);
  let dropped = sentence - OPENING;
  while (
    dropped >= earliest &&
    !opening.every((word, offset) => word === tokens[dropped + offset])
  ) {
    dropped--;
  }
  if (dropped < earliest) return false;

  const droppedRest = tokens.slice(dropped + OPENING, sentence);
  const retakeRest = tokens.slice(
    retake + OPENING,
    Math.min(
      retakeEnd + 1,
      retake + OPENING + droppedRest.length + REWORDING_ROOM,
    ),
  );
  return sharesWording(droppedRest, retakeRest);
}

/**
 * Kept sentences that sit between a dropped delivery of a line and the kept
 * retake of the same line. Inclusive word indices, in order.
 */
export function strandedKeptSpans(words: Word[], cuts: Span[]): Span[] {
  const tokens = words.map(token);
  const kept = keptSpans(cuts, words.length);
  const stranded: Span[] = [];

  for (let i = 0; i + 1 < kept.length; i++) {
    const sentence = kept[i]!;
    const [start, end] = sentence;
    const length = end - start + 1;
    if (start === 0 || length < 2 || length > LONGEST_STRANDED) continue;
    if (!finishes(words[end]!)) continue;

    const cutStart = i === 0 ? 0 : kept[i - 1]![1] + 1;
    if (
      !saidBefore(tokens, cutStart, sentence) &&
      retakesDroppedLine(tokens, cutStart, start, kept[i + 1]!)
    ) {
      stranded.push(sentence);
    }
  }
  return stranded;
}

/** The model's cuts with every stranded sentence cut as well. */
export function cutStrandedSpans(words: Word[], cuts: Span[]): Span[] {
  const stranded = strandedKeptSpans(words, cuts);
  if (stranded.length === 0) return cuts;
  const merged: Span[] = [];
  for (const [start, end] of [...cuts, ...stranded].sort(
    (a, b) => a[0] - b[0],
  )) {
    const last = merged[merged.length - 1];
    if (last && start <= last[1] + 1) last[1] = Math.max(last[1], end);
    else merged.push([start, end]);
  }
  return merged;
}
