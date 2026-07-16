/** Measures the rendered width of a string, in the same units as `maxWidth`. */
export type MeasureText = (text: string) => number;

/**
 * Greedy word-wrap `text` into lines no wider than `maxWidth`. Honours explicit
 * newlines first (matching the preview's `whitespace-pre-wrap`), so a blank line
 * in the caption stays a blank line. A single word wider than `maxWidth` is left
 * whole on its own line rather than split mid-word, exactly as the browser wraps.
 *
 * Pure: the width comes from the injected `measure`, so it needs no canvas and
 * the line-breaking can be reasoned about (and tested) on its own.
 */
export function wrapLines(
  measure: MeasureText,
  text: string,
  maxWidth: number,
): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push("");
      continue;
    }
    let current = "";
    for (const word of words) {
      const next = current ? `${current} ${word}` : word;
      if (current && measure(next) > maxWidth) {
        lines.push(current);
        current = word;
      } else {
        current = next;
      }
    }
    if (current) lines.push(current);
  }
  return lines;
}
