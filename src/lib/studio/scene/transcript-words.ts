import { record } from "./input-guards";

export interface TranscriptWord {
  text: string;
}

const MAX_WORDS = 5_000;
const MAX_WORD_CHARS = 80;
const MAX_TRANSCRIPT_CHARS = 30_000;

/**
 * The transcript as the overlay routes accept it: the kept words in playback
 * order, text only. Timing stays on the client, which aligns the model's
 * quotes back onto its own word clock. The same caps as `overlay-input.ts`,
 * so a transcript the placement pass accepts is one these passes accept.
 */
export function parseTranscriptWords(value: unknown): TranscriptWord[] | null {
  if (!Array.isArray(value) || value.length > MAX_WORDS) return null;
  let chars = 0;
  const words: TranscriptWord[] = [];
  for (const entry of value) {
    const word = record(entry);
    if (
      !word ||
      typeof word.text !== "string" ||
      !word.text.trim() ||
      word.text.length > MAX_WORD_CHARS
    ) {
      return null;
    }
    chars += word.text.length;
    if (chars > MAX_TRANSCRIPT_CHARS) return null;
    words.push({ text: word.text });
  }
  return words;
}
