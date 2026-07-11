/**
 * `@file name.mp4` mentions, the way an editor types them.
 *
 * File names contain spaces, so a mention cannot be "@ up to the next space".
 * While you type, the query is everything after the `@` you are standing in;
 * once typed, a mention is recognised by matching it against the library's real
 * names. Nothing else can be mentioned, which is why nothing has to be escaped.
 */

/** The mention the caret is inside, as a slice of the text. */
export interface MentionSpan {
  /** Index of the `@`. */
  from: number;
  /** Index just past the caret. */
  to: number;
  /** What has been typed after the `@`, which may contain spaces. */
  query: string;
}

/**
 * The mention being typed at `caret`, or null. The `@` must start the text or
 * follow a space, so an email address is never a mention.
 */
export function mentionAt(value: string, caret: number): MentionSpan | null {
  const before = value.slice(0, caret);
  const at = before.lastIndexOf("@");
  if (at < 0) return null;
  if (at > 0 && !/\s/.test(before[at - 1])) return null;
  // A newline ends a mention; a space does not, since names contain them.
  const query = before.slice(at + 1);
  if (/[\n\r]/.test(query)) return null;
  return { from: at, to: caret, query };
}

/** Names worth offering for a query, in the library's own order. */
export function suggestMentions(names: string[], query: string): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return names;
  return names.filter((n) => n.toLowerCase().includes(q));
}

/** Put `name` into the text where the mention was being typed. */
export function applyMention(
  value: string,
  span: MentionSpan,
  name: string,
): { value: string; caret: number } {
  const head = `${value.slice(0, span.from)}@${name} `;
  return { value: head + value.slice(span.to), caret: head.length };
}

/**
 * Which of the library's files the text actually mentions. Matched longest name
 * first, so `@intro.mp4` inside the text of `@intro.mp4.bak` never wins.
 */
export function mentionedNames(value: string, names: string[]): string[] {
  const haystack = value.toLowerCase();
  const byLength = [...names].sort((a, b) => b.length - a.length);
  const found = new Set<string>();
  let left = haystack;
  for (const name of byLength) {
    const needle = `@${name.toLowerCase()}`;
    if (left.includes(needle)) {
      found.add(name);
      left = left.split(needle).join(" ");
    }
  }
  // Back to the library's order, so the model sees them as the user sees them.
  return names.filter((n) => found.has(n));
}
