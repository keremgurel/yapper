/** Map an AI-cleaned transcript back onto the original word tokens.
 *
 * The AI returns the cleaned SPEECH (final takes only), not indices — that's far
 * more reliable than asking it to count token positions. We then align that
 * cleaned text to the original words to decide which to keep.
 *
 * Alignment uses a global sequence score with an affine source-gap penalty.
 * Matching a token is valuable, but opening a new source gap has a cost while
 * extending that same gap is nearly free. That distinction is essential for
 * retakes: it makes one coherent final attempt beat a "Frankenstein" sentence
 * assembled from matching prefixes and suffixes across several earlier takes.
 * Exact-score ties skip source tokens first, which right-anchors duplicate
 * phrases to the speaker's last take.
 */

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9']/g, "");
}

const MATCH_SCORE = 100;
const SOURCE_GAP_OPEN = 3;
const SOURCE_GAP_EXTEND = 0.01;
const CLEANED_GAP = 25;

const ACTION_MATCH = 1;
const ACTION_DELETE_SOURCE = 2;
const ACTION_SKIP_CLEANED = 3;

/** Which source tokens form the most coherent exact rendering of `cleaned`. */
function coherentKeepMask(src: string[], cleaned: string[]): boolean[] {
  const rows = src.length + 1;
  const columns = cleaned.length + 1;
  const cellCount = rows * columns;
  // One byte of backtracking state per cell and gap-state. Scores only need
  // the current and next source row, keeping the large part linear in cells.
  const actions = new Uint8Array(cellCount * 2);
  const actionIndex = (gap: 0 | 1, i: number, j: number) =>
    gap * cellCount + i * columns + j;

  let nextNoGap = new Float64Array(columns);
  let nextGap = new Float64Array(columns);
  for (let j = cleaned.length; j >= 0; j--) {
    const score = -(cleaned.length - j) * CLEANED_GAP;
    nextNoGap[j] = score;
    nextGap[j] = score;
    if (j < cleaned.length) {
      actions[actionIndex(0, src.length, j)] = ACTION_SKIP_CLEANED;
      actions[actionIndex(1, src.length, j)] = ACTION_SKIP_CLEANED;
    }
  }

  for (let i = src.length - 1; i >= 0; i--) {
    const currentNoGap = new Float64Array(columns);
    const currentGap = new Float64Array(columns);
    currentNoGap[cleaned.length] =
      -SOURCE_GAP_OPEN - (src.length - i) * SOURCE_GAP_EXTEND;
    currentGap[cleaned.length] = -(src.length - i) * SOURCE_GAP_EXTEND;
    actions[actionIndex(0, i, cleaned.length)] = ACTION_DELETE_SOURCE;
    actions[actionIndex(1, i, cleaned.length)] = ACTION_DELETE_SOURCE;

    for (let j = cleaned.length - 1; j >= 0; j--) {
      const match =
        src[i] && src[i] === cleaned[j]
          ? MATCH_SCORE + nextNoGap[j + 1]
          : Number.NEGATIVE_INFINITY;
      const skipCleaned = -CLEANED_GAP + currentNoGap[j + 1];

      const choose = (
        deleteSource: number,
      ): { score: number; action: number } => {
        // Prefer deleting source on a tie: the identical matching token later
        // in the recording is the final take.
        if (deleteSource >= match && deleteSource >= skipCleaned) {
          return { score: deleteSource, action: ACTION_DELETE_SOURCE };
        }
        if (match >= skipCleaned) {
          return { score: match, action: ACTION_MATCH };
        }
        return { score: skipCleaned, action: ACTION_SKIP_CLEANED };
      };

      const withoutGap = choose(-SOURCE_GAP_OPEN + nextGap[j]);
      currentNoGap[j] = withoutGap.score;
      actions[actionIndex(0, i, j)] = withoutGap.action;

      const inGap = choose(-SOURCE_GAP_EXTEND + nextGap[j]);
      currentGap[j] = inGap.score;
      actions[actionIndex(1, i, j)] = inGap.action;
    }
    nextNoGap = currentNoGap;
    nextGap = currentGap;
  }

  const keep = new Array(src.length).fill(false);
  let i = 0;
  let j = 0;
  let gap: 0 | 1 = 0;
  while (i < src.length || j < cleaned.length) {
    const action = actions[actionIndex(gap, i, j)];
    if (action === ACTION_MATCH) {
      keep[i] = true;
      i++;
      j++;
      gap = 0;
    } else if (action === ACTION_DELETE_SOURCE) {
      i++;
      gap = 1;
    } else if (action === ACTION_SKIP_CLEANED) {
      j++;
      gap = 0;
    } else {
      break;
    }
  }
  return keep;
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

  const keep = coherentKeepMask(src, cleaned);
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
