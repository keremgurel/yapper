/** Map an AI-cleaned transcript back onto the original word tokens.
 *
 * The AI returns the cleaned SPEECH (final takes only), not indices — that's far
 * more reliable than asking it to count token positions. We then align that
 * cleaned text to the original words to decide which to keep. The alignment runs
 * from the RIGHT so a phrase that was restated maps to its LAST occurrence,
 * which is exactly the take the speaker kept.
 */

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9']/g, "");
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
  let i = words.length - 1;
  let j = cleaned.length - 1;
  while (i >= 0 && j >= 0) {
    if (src[i] === "") {
      keep[i] = true; // punctuation-only token — never a cut
      i--;
    } else if (src[i] === cleaned[j]) {
      keep[i] = true;
      i--;
      j--;
    } else {
      i--;
    }
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
