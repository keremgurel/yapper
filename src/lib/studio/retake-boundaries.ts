type Word = { text: string; start?: number; end?: number };

/** Find a cut that clips the onset of a repeated, otherwise retained phrase.
 * This is a reason to ask the model to correct its decision, never permission
 * to restore arbitrary rejected words. Five matching tokens provide context;
 * adjacent stutters and detached prefixes are deliberately excluded. */
export function clippedRetakeOpenings(
  words: Word[],
  cuts: [number, number][],
): number[] {
  const removed = new Set(
    cuts.flatMap(([a, b]) =>
      Array.from({ length: b - a + 1 }, (_, i) => a + i),
    ),
  );
  const tokens = words.map((word) =>
    word.text.toLowerCase().replace(/[^\p{L}\p{N}']/gu, ""),
  );
  const connected = (index: number) => {
    const end = words[index]?.end;
    const start = words[index + 1]?.start;
    return (
      typeof start === "number" &&
      typeof end === "number" &&
      start - end >= -0.05 &&
      start - end <= 0.3
    );
  };
  const issues: number[] = [];
  for (let start = 1; start + 3 < words.length; start++) {
    if (
      !removed.has(start - 1) ||
      [0, 1, 2, 3].some((offset) => removed.has(start + offset)) ||
      tokens[start - 1] === tokens[start] ||
      ![start - 1, start, start + 1, start + 2].every(connected)
    )
      continue;
    const earlier = Array.from(
      { length: Math.min(160, start - 1) },
      (_, i) => start - 2 - i,
    );
    if (
      earlier.some(
        (index) =>
          index + 4 < start - 1 &&
          [0, 1, 2, 3, 4].every(
            (offset) => tokens[index + offset] === tokens[start - 1 + offset],
          ) &&
          [index, index + 1, index + 2, index + 3].every(connected),
      )
    )
      issues.push(start - 1);
  }
  return issues;
}
