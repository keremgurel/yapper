/**
 * Map a semantically cleaned transcript back to whole, contiguous source
 * takes. Unlike token-by-token global alignment, this can never build a
 * sentence from the beginning of one recording attempt and the ending of a
 * later one.
 */

function norm(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9']/g, "");
}

interface Candidate {
  start: number;
  end: number;
  errors: number;
  targetWords: number;
}

function editDistance(a: string[], b: string[]): number {
  let previous = new Uint16Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) previous[j] = j;
  for (let i = 1; i <= a.length; i++) {
    const current = new Uint16Array(b.length + 1);
    current[0] = i;
    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    previous = current;
  }
  return previous[b.length];
}

function bestContiguousCandidate(
  source: string[],
  target: string[],
): Candidate | null {
  if (target.length === 0 || source.length === 0) return null;
  let best: Candidate | null = null;
  let minimumErrors = Number.POSITIVE_INFINITY;
  const lengthSlack = Math.max(2, Math.min(5, Math.ceil(target.length * 0.12)));
  for (let start = 0; start < source.length; start++) {
    for (
      let length = Math.max(1, target.length - lengthSlack);
      length <= target.length + lengthSlack && start + length <= source.length;
      length++
    ) {
      const errors = editDistance(source.slice(start, start + length), target);
      minimumErrors = Math.min(minimumErrors, errors);
      const laterNearMatch =
        best != null &&
        target.length >= 6 &&
        start > best.start &&
        errors <= minimumErrors + 1 &&
        errors / target.length <= 0.16;
      // Retakes resolve to the speaker's final attempt. The final correction
      // can legitimately add or remove one small word ("the", "a", "to"), so
      // a later near-identical clause outranks an earlier verbatim one. Without
      // this, text similarity kept the middle of three spoken attempts merely
      // because the model's cleaned sentence omitted the final article.
      if (
        !best ||
        errors < best.errors ||
        (errors === best.errors && start > best.start) ||
        laterNearMatch
      ) {
        best = {
          start,
          end: start + length - 1,
          errors,
          targetWords: target.length,
        };
      }
    }
  }
  return best;
}

/**
 * Split the clean script into independently placeable spoken clauses.
 *
 * A speaker often corrects only the tail of a sentence:
 *
 *   "Members get access forever, plus eight free credits ..."
 *                                      "Plus eight free credits ..."
 *
 * Treating that entire sentence as one target forces the mapper to keep the
 * first suffix because only it is contiguous with the prefix. Commas are real
 * restart boundaries in spoken scripts, so a substantial comma-delimited
 * clause is mapped on its own and the existing right-biased tie breaker can
 * select the later correction. Very short comma fragments stay attached to
 * their neighbors to avoid matching generic one- or two-word phrases.
 */
function thoughtTokens(cleaned: string): string[][] {
  const tokens = cleaned.trim().split(/\s+/).filter(Boolean);
  const thoughts: string[][] = [];
  let current: string[] = [];
  for (const token of tokens) {
    current.push(token);
    const terminal = /[.!?]["')\]]*$/.test(token);
    const substantialCommaClause =
      /[,;:]["')\]]*$/.test(token) &&
      current.map(norm).filter(Boolean).length >= 4;
    if (terminal || substantialCommaClause) {
      thoughts.push(current);
      current = [];
    }
  }
  if (current.length > 0) thoughts.push(current);
  return thoughts;
}

function clauseBreaks(tokens: string[]): number[] {
  const breaks: number[] = [];
  for (let index = 1; index < tokens.length; index++) {
    if (
      /[,;:]$/.test(tokens[index - 1]) &&
      /^(and|but|so|to)$/i.test(norm(tokens[index]))
    ) {
      breaks.push(index);
    }
  }
  return breaks;
}

const MAX_ERROR_FRACTION = 0.16;

function mapOneCleanThought(
  source: string[],
  originalTokens: string[],
): Candidate[] {
  const target = originalTokens.map(norm).filter(Boolean);
  const whole = bestContiguousCandidate(source, target);
  if (
    whole &&
    whole.errors / Math.max(1, whole.targetWords) <= MAX_ERROR_FRACTION
  ) {
    return [whole];
  }

  // A model may join two independently clean source sentences with a comma.
  // Split only at an explicit clause boundary, then map each half as its own
  // contiguous take. This is still incapable of silently joining partial
  // source attempts because each half must independently meet the threshold.
  const breaks = clauseBreaks(originalTokens);
  for (let index = breaks.length - 1; index >= 0; index--) {
    const at = breaks[index];
    const left = mapOneCleanThought(source, originalTokens.slice(0, at));
    const right = mapOneCleanThought(source, originalTokens.slice(at));
    if (left.length > 0 && right.length > 0) return [...left, ...right];
  }
  return [];
}

export interface ContiguousTakeAlignment {
  /** Inclusive source-word ranges to keep. */
  keep: [number, number][];
  /** Fraction of the cleaned transcript represented by safe source takes. */
  coverage: number;
}

export function alignCleanedToContiguousTakes(
  words: { text: string }[],
  cleaned: string,
): ContiguousTakeAlignment {
  const source = words.map(({ text }) => norm(text));
  const thoughts = thoughtTokens(cleaned);
  const candidates = thoughts.flatMap((tokens) =>
    mapOneCleanThought(source, tokens),
  );
  const cleanedWordCount = thoughts.reduce(
    (sum, tokens) => sum + tokens.map(norm).filter(Boolean).length,
    0,
  );

  // Resolve overlap in favor of the lower-error candidate, then restore source
  // chronology. The model is not allowed to reorder the actual recording.
  candidates.sort(
    (a, b) =>
      a.errors / a.targetWords - b.errors / b.targetWords || b.start - a.start,
  );
  const chosen: Candidate[] = [];
  for (const candidate of candidates) {
    if (
      chosen.some(
        (other) => candidate.start <= other.end && candidate.end >= other.start,
      )
    ) {
      continue;
    }
    chosen.push(candidate);
  }
  chosen.sort((a, b) => a.start - b.start);

  const keep: [number, number][] = [];
  for (const candidate of chosen) {
    const last = keep[keep.length - 1];
    if (last && candidate.start <= last[1] + 1) {
      last[1] = Math.max(last[1], candidate.end);
    } else {
      keep.push([candidate.start, candidate.end]);
    }
  }
  const represented = chosen.reduce(
    (sum, candidate) => sum + candidate.targetWords,
    0,
  );
  return {
    keep,
    coverage:
      cleanedWordCount === 0 ? 0 : Math.min(1, represented / cleanedWordCount),
  };
}

/** Convert safe kept spans into the inclusive word ranges the editor cuts. */
export function cutsOutsideKeptTakes(
  wordCount: number,
  keep: [number, number][],
): [number, number][] {
  const cuts: [number, number][] = [];
  let cursor = 0;
  for (const [start, end] of keep) {
    if (start > cursor) cuts.push([cursor, start - 1]);
    cursor = Math.max(cursor, end + 1);
  }
  if (cursor < wordCount) cuts.push([cursor, wordCount - 1]);
  return cuts;
}
