export interface Insertion {
  text: string;
  /** Where the caret belongs afterwards: just past the inserted words, so the
   * creator can keep typing mid-thought without repositioning. */
  caret: number;
}

/**
 * Splice dictated words into what is already typed, at the caret.
 *
 * Dictation used to append to the end of the composer unconditionally, which
 * breaks the way people actually capture: type a bit, say a bit, go back and
 * type more. Words spoken while the caret sat mid-sentence landed at the
 * bottom, detached from the thought they belonged to.
 *
 * A selection is replaced rather than pushed aside, matching what typing into
 * a selection does everywhere else.
 *
 * Spacing is inferred rather than always inserted: ASR returns bare words with
 * no leading or trailing space, so joining naively gives either "abchello" or
 * a double space depending on where the caret was.
 */
export function insertDictation(
  current: string,
  words: string,
  selectionStart: number,
  selectionEnd: number = selectionStart,
): Insertion {
  const spoken = words.trim();
  if (!spoken) return { text: current, caret: selectionStart };

  // An out-of-range or unknown caret means "we never saw one": append, which is
  // the only safe guess and matches the old behaviour.
  const inRange =
    Number.isFinite(selectionStart) &&
    selectionStart >= 0 &&
    selectionStart <= current.length;
  const start = inRange ? selectionStart : current.length;
  // Sanitized against `start` rather than the raw argument: NaN propagates
  // through Math.max/min, and `slice(NaN)` silently becomes `slice(0)`, which
  // would duplicate the whole composer instead of appending to it.
  const rawEnd = Number.isFinite(selectionEnd) ? selectionEnd : start;
  const end = Math.min(Math.max(rawEnd, start), current.length);

  const before = current.slice(0, start);
  const after = current.slice(end);

  const needsSpaceBefore = before.length > 0 && !/\s$/.test(before);
  // No space before a closing bracket or ordinary punctuation: the dictated
  // clause belongs to the sentence that follows, not detached from it.
  const needsSpaceAfter = after.length > 0 && !/^[\s.,;:!?)\]}]/.test(after);

  const middle = `${needsSpaceBefore ? " " : ""}${spoken}${
    needsSpaceAfter ? " " : ""
  }`;

  return {
    text: `${before}${middle}${after}`,
    caret: before.length + middle.length - (needsSpaceAfter ? 1 : 0),
  };
}
