/** Map an AI-cleaned transcript back onto the original word tokens.
 *
 * The AI returns the cleaned SPEECH (final takes only), not indices — that's far
 * more reliable than asking it to count token positions. We then align that
 * cleaned text to the original words to decide which to keep.
 *
 * The alignment is a Ratcliff/Obershelp-style matching-blocks search (the
 * algorithm behind Python's difflib): recursively find the single longest
 * contiguous run shared between the two token streams, then recurse on the
 * gaps before and after it. Finding the best block globally, rather than
 * walking token-by-token from one end, matters a lot on a transcript full of
 * near-identical retakes: a naive nearest-neighbor walk can latch onto a
 * single stray shared word (e.g. "the") deep inside an earlier, wrong take and
 * zig-zag across several takes instead of resolving to one clean run. That
 * scatters false "keep" hits through the takes that should be cut whole.
 */

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9']/g, "");
}

interface MatchBlock {
  srcStart: number;
  cleanedStart: number;
  length: number;
}

/**
 * The longest contiguous run of tokens shared between src[srcLo, srcHi) and
 * cleaned[cleanedLo, cleanedHi). Ties prefer the run that starts latest in
 * src, so a phrase repeated across several retakes resolves to its most
 * recent occurrence — the one the speaker actually kept — rather than an
 * earlier attempt.
 */
function findLongestMatch(
  src: string[],
  cleaned: string[],
  srcLo: number,
  srcHi: number,
  cleanedLo: number,
  cleanedHi: number,
): MatchBlock {
  const positionsByToken = new Map<string, number[]>();
  for (let j = cleanedLo; j < cleanedHi; j++) {
    const token = cleaned[j];
    if (!token) continue;
    const list = positionsByToken.get(token);
    if (list) list.push(j);
    else positionsByToken.set(token, [j]);
  }

  let bestSrcStart = srcLo;
  let bestCleanedStart = cleanedLo;
  let bestLength = 0;
  let runLengthEndingAt = new Map<number, number>();
  for (let i = srcLo; i < srcHi; i++) {
    const nextRunLengths = new Map<number, number>();
    const token = src[i];
    const positions = token ? positionsByToken.get(token) : undefined;
    if (positions) {
      for (const j of positions) {
        const length = (runLengthEndingAt.get(j - 1) ?? 0) + 1;
        nextRunLengths.set(j, length);
        const startInSrc = i - length + 1;
        if (
          length > bestLength ||
          (length === bestLength && startInSrc >= bestSrcStart)
        ) {
          bestLength = length;
          bestSrcStart = startInSrc;
          bestCleanedStart = j - length + 1;
        }
      }
    }
    runLengthEndingAt = nextRunLengths;
  }
  return {
    srcStart: bestSrcStart,
    cleanedStart: bestCleanedStart,
    length: bestLength,
  };
}

function matchingBlocks(
  src: string[],
  cleaned: string[],
  srcLo: number,
  srcHi: number,
  cleanedLo: number,
  cleanedHi: number,
  out: MatchBlock[],
): void {
  const match = findLongestMatch(
    src,
    cleaned,
    srcLo,
    srcHi,
    cleanedLo,
    cleanedHi,
  );
  if (match.length === 0) return;
  matchingBlocks(
    src,
    cleaned,
    srcLo,
    match.srcStart,
    cleanedLo,
    match.cleanedStart,
    out,
  );
  out.push(match);
  matchingBlocks(
    src,
    cleaned,
    match.srcStart + match.length,
    srcHi,
    match.cleanedStart + match.length,
    cleanedHi,
    out,
  );
}

/**
 * Given the original words (in order) and the AI's cleaned text, return the
 * inclusive index ranges of words to CUT (the earlier attempts and stutters the
 * cleaned text dropped). A word that normalizes to empty (punctuation-only) is
 * always kept, never cut.
 */
export function cutsFromCleanedText(
  words: { text: string }[],
  cleanedText: string,
): [number, number][] {
  const src = words.map((w) => norm(w.text));
  const cleaned = cleanedText
    .split(/\s+/)
    .map(norm)
    .filter((t) => t.length > 0);

  const keep = new Array(words.length).fill(false);
  const blocks: MatchBlock[] = [];
  matchingBlocks(src, cleaned, 0, src.length, 0, cleaned.length, blocks);
  for (const block of blocks) {
    for (let k = 0; k < block.length; k++) keep[block.srcStart + k] = true;
  }
  for (let k = 0; k < words.length; k++) if (src[k] === "") keep[k] = true;

  const cuts: [number, number][] = [];
  let start = -1;
  for (let k = 0; k <= words.length; k++) {
    if (k < words.length && !keep[k]) {
      if (start < 0) start = k;
    } else if (start >= 0) {
      cuts.push([start, k - 1]);
      start = -1;
    }
  }
  return cuts;
}
