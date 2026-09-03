/**
 * Why the production validator said no, in words a model can act on.
 *
 * `retakeCutsFromResponse` fails closed and returns null. For a repair turn we
 * need the specific violations, so this re-derives them with the same rules.
 */
export function explainRejection(text, wordCount) {
  const json = text.match(/\{[\s\S]*\}/);
  if (!json) return ["The reply contained no JSON object."];
  let parsed;
  try {
    parsed = JSON.parse(json[0]);
  } catch (error) {
    return [`The JSON did not parse: ${error.message}`];
  }
  const blocks = parsed?.blocks;
  if (!Array.isArray(blocks)) return ["The JSON has no blocks array."];

  const problems = [];
  const okSpan = (s) =>
    Array.isArray(s) &&
    s.length === 2 &&
    Number.isInteger(s[0]) &&
    Number.isInteger(s[1]) &&
    s[0] >= 0 &&
    s[1] < wordCount &&
    s[0] <= s[1];
  const overlaps = (a, b) => a[0] <= b[1] && b[0] <= a[1];

  const keeps = [];
  const drops = [];
  blocks.forEach((block, i) => {
    if (!Array.isArray(block?.keep) || block.keep.length === 0) {
      problems.push(
        `Block ${i} has no keep range; every block keeps something.`,
      );
    }
    for (const span of block?.keep ?? []) {
      if (!okSpan(span)) {
        problems.push(
          `Block ${i} keep ${JSON.stringify(span)} is not a valid inclusive range within 0..${wordCount - 1}.`,
        );
      } else keeps.push(span);
    }
    for (const span of block?.drop ?? []) {
      if (!okSpan(span)) {
        problems.push(
          `Block ${i} drop ${JSON.stringify(span)} is not a valid inclusive range within 0..${wordCount - 1}.`,
        );
      } else drops.push(span);
    }
  });
  for (const drop of drops) {
    for (const keep of keeps) {
      if (overlaps(drop, keep)) {
        problems.push(
          `drop ${JSON.stringify(drop)} overlaps keep ${JSON.stringify(keep)}.`,
        );
      }
    }
  }
  const sorted = [...drops].sort((a, b) => a[0] - b[0]);
  for (let i = 1; i < sorted.length; i++) {
    if (overlaps(sorted[i - 1], sorted[i])) {
      problems.push(
        `drop ${JSON.stringify(sorted[i - 1])} overlaps drop ${JSON.stringify(sorted[i])}.`,
      );
    }
  }
  const removed = drops.reduce((sum, [a, b]) => sum + (b - a + 1), 0);
  if (removed > wordCount * 0.85) {
    problems.push(
      `The drops remove ${removed} of ${wordCount} words; no real edit removes more than 85%.`,
    );
  }
  return problems.length
    ? problems
    : ["The reply was rejected for an unknown reason."];
}
