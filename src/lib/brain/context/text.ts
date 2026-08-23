/**
 * The two text primitives the whole compiler shares: how a value is cut down to
 * a budget, and how a piece of text becomes the token set that scoring uses.
 *
 * Both live here rather than in the files that call them because the compiler's
 * output has to be reproducible: a second copy of `clamp` that truncated one
 * character differently would silently change every prompt that used it.
 */

/** Collapse whitespace and cap length. Truncation is on a word boundary so a
 * value never ends mid-word, which reads as corrupted to both humans and
 * models. */
export function clamp(value: string, max: number): string {
  const flat = (value ?? "").replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/** Same cap, but newlines survive. For a doc chunk or a note, where the shape
 * of the text is part of what it says. */
export function clampBlock(value: string, max: number): string {
  const trimmed = (value ?? "").replace(/[ \t]+/g, " ").trim();
  if (trimmed.length <= max) return trimmed;
  const cut = trimmed.slice(0, max);
  const lastBreak = Math.max(cut.lastIndexOf("\n"), cut.lastIndexOf(" "));
  return `${(lastBreak > max * 0.6 ? cut.slice(0, lastBreak) : cut).trimEnd()}…`;
}

// Short, deliberately. A longer stoplist starts throwing away words that carry
// the topic ("how" in "how to", "why" in a title), and the scoring below only
// needs the words that appear in nearly every sentence to stop dominating it.
const STOPWORDS = new Set([
  "the",
  "and",
  "for",
  "that",
  "this",
  "with",
  "you",
  "your",
  "are",
  "was",
  "were",
  "but",
  "not",
  "from",
  "have",
  "has",
  "had",
  "they",
  "them",
  "their",
  "will",
  "would",
  "can",
  "could",
  "about",
  "into",
  "than",
  "then",
  "there",
  "here",
  "what",
  "when",
  "who",
  "its",
  "it's",
  "one",
  "all",
  "any",
  "get",
  "got",
  "out",
  "make",
  "made",
  "just",
  "like",
  "some",
  "more",
  "most",
  "video",
  "content",
]);

/**
 * The words a piece of text contributes to matching.
 *
 * Deliberately crude: lowercase, split on anything that is not a letter or
 * digit, drop very short words and the stoplist. This is a relevance nudge for
 * choosing which of a dozen sections to load, not a search engine, and anything
 * cleverer would be harder to reason about when a creator asks why their
 * keyword table was not read.
 */
export function tokenize(value: string): Set<string> {
  const tokens = new Set<string>();
  for (const raw of (value ?? "").toLowerCase().split(/[^a-z0-9']+/)) {
    const word = raw.replace(/^'+|'+$/g, "");
    if (word.length < 3 || STOPWORDS.has(word)) continue;
    tokens.add(word);
    // A crude singular, so "hooks" in the task matches "hook" in a tag.
    if (word.length > 4 && word.endsWith("s") && !word.endsWith("ss")) {
      tokens.add(word.slice(0, -1));
    }
  }
  return tokens;
}

/** How much of `text` the task is asking about. Counts distinct matches rather
 * than occurrences, so one word repeated twenty times cannot outrank a line
 * that matches three different things the task mentioned. */
export function overlapScore(task: Set<string>, text: string): number {
  if (task.size === 0) return 0;
  let hits = 0;
  for (const token of tokenize(text)) {
    if (task.has(token)) hits += 1;
  }
  return hits;
}
