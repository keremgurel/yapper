/** The named entities that actually show up in scraped og: meta text. Kept
 * small on purpose: unknown names are left untouched rather than guessed at. */
const NAMED: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

/**
 * Decode the HTML entities that leak out of Open Graph scraping, so a title like
 * `Tips &amp; Tricks` or an Instagram caption full of `&#x27;` reads as real
 * text on the card. Handles named entities plus decimal (`&#39;`) and hex
 * (`&#x27;`) numeric references; anything unrecognized is left exactly as-is,
 * so this can never mangle a string it does not understand. Pure.
 */
export function decodeEntities(input: string): string {
  return input.replace(
    /&(#\d+|#x[0-9a-f]+|[a-z][a-z0-9]*);/gi,
    (match, body: string) => {
      if (body[0] === "#") {
        const code =
          body[1] === "x" || body[1] === "X"
            ? parseInt(body.slice(2), 16)
            : parseInt(body.slice(1), 10);
        if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return match;
        try {
          return String.fromCodePoint(code);
        } catch {
          return match;
        }
      }
      return NAMED[body.toLowerCase()] ?? match;
    },
  );
}
