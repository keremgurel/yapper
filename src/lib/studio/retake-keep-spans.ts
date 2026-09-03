/**
 * Reading a keep only answer: `{"keep":[[first,last],...]}` becomes the word
 * ranges to delete.
 *
 * Two things are forgiven because they have one safe reading. An end index one
 * past the last word is a fencepost, so it is clamped; models produce it on a
 * transcript of N words often enough that refusing it would refuse good edits.
 * Kept spans that overlap or touch are merged; a word listed twice is a word
 * the model wants, not a contradiction. Everything else fails closed: an
 * unreadable reply, a span that points outside the transcript, or an edit that
 * keeps so little that the model has plainly misread the indices.
 */

/** No real edit of a talking head take keeps less than this share of it. */
const LEAST_THAT_MAY_STAY = 0.15;

type Span = [number, number];

function tidySpan(value: unknown, wordCount: number): Span | null {
  if (!Array.isArray(value) || value.length !== 2) return null;
  let [start, end] = value as unknown[];
  if (!Number.isInteger(start) || !Number.isInteger(end)) return null;
  if ((start as number) > (end as number)) [start, end] = [end, start];
  if (end === wordCount) end = wordCount - 1;
  if ((start as number) < 0 || (end as number) >= wordCount) return null;
  return [start as number, end as number];
}

function mergeSpans(spans: Span[]): Span[] {
  const sorted = [...spans].sort((a, b) => a[0] - b[0]);
  const merged: Span[] = [];
  for (const span of sorted) {
    const last = merged[merged.length - 1];
    if (last && span[0] <= last[1] + 1) last[1] = Math.max(last[1], span[1]);
    else merged.push([span[0], span[1]]);
  }
  return merged;
}

function complement(kept: Span[], wordCount: number): Span[] {
  const cuts: Span[] = [];
  let cursor = 0;
  for (const [start, end] of kept) {
    if (start > cursor) cuts.push([cursor, start - 1]);
    cursor = Math.max(cursor, end + 1);
  }
  if (cursor <= wordCount - 1) cuts.push([cursor, wordCount - 1]);
  return cuts;
}

/**
 * The deletions a keep only answer implies, or null when it cannot be trusted.
 * An answer that keeps every word yields no cuts, which the editor reads as a
 * take with nothing to remove.
 */
export function cutsFromKeptSpans(
  text: string,
  wordCount: number,
): Span[] | null {
  const json = text.match(/\{[\s\S]*\}/);
  if (!json) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(json[0]);
  } catch {
    return null;
  }
  const raw = (parsed as { keep?: unknown } | null)?.keep;
  if (!Array.isArray(raw) || raw.length === 0) return null;

  const spans: Span[] = [];
  for (const value of raw) {
    const span = tidySpan(value, wordCount);
    if (!span) return null;
    spans.push(span);
  }
  const kept = mergeSpans(spans);
  const keptWords = kept.reduce((sum, [a, b]) => sum + (b - a + 1), 0);
  if (keptWords < wordCount * LEAST_THAT_MAY_STAY) return null;
  return complement(kept, wordCount);
}
