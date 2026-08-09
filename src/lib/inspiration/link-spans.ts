/** A run of the composer's text: either prose or a link. */
export interface LinkSpan {
  text: string;
  isLink: boolean;
  /** Index of the first character, into the original string. */
  start: number;
  /** Index one past the last character. */
  end: number;
}

/**
 * URLs, as people actually paste them. Trailing punctuation is deliberately
 * excluded: "see https://a.com, then" ends the link at the comma, because a
 * comma is far more often the sentence's than the URL's.
 */
const URL_PATTERN = /https?:\/\/[^\s]+/gi;
const TRAILING = /[),.;!?]+$/;

/**
 * Splits the composer's text into prose and the links inside it.
 *
 * The links stay where they were typed. They used to be pulled out of the text
 * into an attachment row underneath, which reads fine for a capture that is
 * only a link and badly for a sentence with one in the middle: "watch this"
 * and the thing to watch ended up in two different places, and the sentence
 * lost the word it was pointing at.
 */
export function linkSpans(text: string): LinkSpan[] {
  const spans: LinkSpan[] = [];
  let cursor = 0;

  for (const match of text.matchAll(URL_PATTERN)) {
    const raw = match[0];
    const start = match.index ?? 0;
    const trimmed = raw.replace(TRAILING, "");
    if (!trimmed) continue;

    if (start > cursor) {
      spans.push({
        text: text.slice(cursor, start),
        isLink: false,
        start: cursor,
        end: start,
      });
    }
    spans.push({
      text: trimmed,
      isLink: true,
      start,
      end: start + trimmed.length,
    });
    cursor = start + trimmed.length;
  }

  if (cursor < text.length) {
    spans.push({
      text: text.slice(cursor),
      isLink: false,
      start: cursor,
      end: text.length,
    });
  }
  return spans;
}

/** Every link in the text, in the order they appear. */
export function linksIn(text: string): string[] {
  return linkSpans(text)
    .filter((span) => span.isLink)
    .map((span) => span.text);
}

/**
 * The link the caret is sitting immediately after, if any.
 *
 * What makes Backspace behave like it does everywhere else a chip is editable:
 * the first press takes hold of the whole link rather than nibbling a character
 * off the end of it, and the second press deletes it.
 */
export function linkEndingAt(text: string, caret: number): LinkSpan | null {
  return (
    linkSpans(text).find((span) => span.isLink && span.end === caret) ?? null
  );
}

/** The link a caret sits inside or against, for selecting one by clicking. */
export function linkAt(text: string, caret: number): LinkSpan | null {
  return (
    linkSpans(text).find(
      (span) => span.isLink && caret >= span.start && caret <= span.end,
    ) ?? null
  );
}
