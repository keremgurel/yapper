export interface DiffToken {
  text: string;
  /** True when this word is not carried over from the original line. */
  changed: boolean;
}

const normalize = (word: string) =>
  word.toLowerCase().replace(/[^\p{L}\p{N}']/gu, "");

/**
 * Mark which words of a rewritten line are new. Words kept from the original,
 * in order, are the longest common subsequence of the two lines; everything
 * else in the rewrite is what changed. Comparison ignores case and
 * punctuation, so "home," and "home" count as the same word.
 */
export function diffRewrite(before: string, after: string): DiffToken[] {
  const a = before.split(/\s+/).filter(Boolean).map(normalize);
  const words = after.split(/\s+/).filter(Boolean);
  const b = words.map(normalize);

  // lcs[i][j] = length of the common subsequence of a[i..] and b[j..].
  const lcs = Array.from({ length: a.length + 1 }, () =>
    new Array<number>(b.length + 1).fill(0),
  );
  for (let i = a.length - 1; i >= 0; i -= 1)
    for (let j = b.length - 1; j >= 0; j -= 1)
      lcs[i][j] =
        a[i] && a[i] === b[j]
          ? lcs[i + 1][j + 1] + 1
          : Math.max(lcs[i + 1][j], lcs[i][j + 1]);

  const kept = new Set<number>();
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] && a[i] === b[j]) {
      kept.add(j);
      i += 1;
      j += 1;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) i += 1;
    else j += 1;
  }
  return words.map((text, index) => ({ text, changed: !kept.has(index) }));
}
