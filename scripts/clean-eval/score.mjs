/** Word level agreement between a model's deletions and the audited edit. */
export function scoreCuts(cuts, fixture) {
  const predicted = new Set(
    cuts.flatMap(([start, end]) =>
      Array.from({ length: end - start + 1 }, (_, offset) => start + offset),
    ),
  );
  let tp = 0;
  let wrongDeletions = 0;
  for (const index of predicted) {
    if (fixture.expectedDrop.has(index)) tp++;
    else wrongDeletions++;
  }
  let mistakesLeft = 0;
  for (const index of fixture.expectedDrop) {
    if (!predicted.has(index)) mistakesLeft++;
  }
  const precision = tp / Math.max(1, tp + wrongDeletions);
  const recall = tp / Math.max(1, tp + mistakesLeft);
  const f1 =
    (2 * precision * recall) / Math.max(Number.EPSILON, precision + recall);
  return {
    precision: round(precision),
    recall: round(recall),
    f1: round(f1),
    wrongDeletions,
    mistakesLeft,
    removedWords: predicted.size,
  };
}

function round(value) {
  return Number(value.toFixed(4));
}
