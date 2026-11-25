import type { TimedWord } from "../../format/content-spec";

export interface CaptionChunk {
  text: string;
  start: number;
  end: number;
}

/** A pause this long ends the caption instead of holding it until the next word. */
const PAUSE_S = 0.7;
const SENTENCE_END = /[.!?]["')\]]?$/;
const TRAILING_PUNCTUATION = /[.,;:!?]+(["')\]]?)$/;

/** Captions carry no sentence punctuation. Marks inside a word (`$1,200`, `we're`) stay. */
const bare = (word: string) => word.trim().replace(TRAILING_PUNCTUATION, "$1");

/**
 * Groups words into captions of at most `maxWords`. A caption closes early at
 * the end of a sentence or before a pause, and otherwise stays up until the
 * next one starts, so the text never blinks off between words.
 */
export function chunkWords(
  words: readonly TimedWord[],
  maxWords: number,
): CaptionChunk[] {
  const chunks: CaptionChunk[] = [];
  let open: TimedWord[] = [];

  words.forEach((word, index) => {
    if (bare(word.text) === "") return;
    open.push(word);
    const next = words[index + 1];
    const pauseAfter = !next || next.start - word.end > PAUSE_S;
    if (
      open.length < maxWords &&
      !SENTENCE_END.test(word.text.trim()) &&
      !pauseAfter
    ) {
      return;
    }
    chunks.push({
      text: open.map((w) => bare(w.text)).join(" "),
      start: open[0].start,
      end: pauseAfter || !next ? word.end : next.start,
    });
    open = [];
  });

  return chunks;
}
