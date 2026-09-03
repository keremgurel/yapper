/**
 * Deterministic hints: where the speaker repeats themself.
 *
 * A retake almost always repeats a few words of the attempt it replaces. This
 * finds runs of normalised words that occur again within a window and reports
 * each pair as "earlier span repeats at later span". The model still decides
 * what to cut; the pairs only tell it where to look.
 */
export function repeatedPairs(words, { n = 4, window = 300, max = 60 } = {}) {
  const tokens = words.map((w) =>
    w.text.toLowerCase().replace(/[^\p{L}\p{N}']/gu, ""),
  );
  const lastSeen = new Map();
  const pairs = [];
  for (let i = 0; i + n <= tokens.length; i++) {
    const key = tokens.slice(i, i + n).join(" ");
    if (key.replace(/ /g, "").length < 10) {
      lastSeen.set(key, i);
      continue;
    }
    const previous = lastSeen.get(key);
    if (previous !== undefined && i - previous <= window) {
      const last = pairs[pairs.length - 1];
      // Extend a run when this n-gram continues the previous match one word on.
      if (
        last &&
        last.from[1] === previous + n - 2 &&
        last.to[1] === i + n - 2
      ) {
        last.from[1] = previous + n - 1;
        last.to[1] = i + n - 1;
      } else {
        pairs.push({ from: [previous, previous + n - 1], to: [i, i + n - 1] });
      }
    }
    lastSeen.set(key, i);
  }
  return pairs.slice(0, max);
}

export function anchorsParagraph(pairs) {
  if (pairs.length === 0) return "";
  const list = pairs
    .map((p) => `${p.from[0]}-${p.from[1]} again at ${p.to[0]}-${p.to[1]}`)
    .join("; ");
  return (
    "Repeated phrases found mechanically (earlier words, then where the same " +
    "words recur). Each is a likely retake seam; still read the whole " +
    `transcript because retakes that reword themselves are not listed: ${list}`
  );
}
