export interface CleanTranscriptWord {
  text: string;
  /**
   * Where the word sits in the recording, when the client knows. Only used to
   * split a long transcript at a real pause rather than mid-retake, so a
   * transcript without timings still works, it just splits on word count.
   */
  start?: number;
  end?: number;
}

export const MAX_CLEAN_TRANSCRIPT_WORDS = 5_000;
export const MAX_CLEAN_TRANSCRIPT_WORD_CHARS = 80;
export const MAX_CLEAN_TRANSCRIPT_CHARS = 30_000;

/** Validate the client transcript before any prompt or alignment work begins. */
export function parseCleanTranscriptWords(
  value: unknown,
): CleanTranscriptWord[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  if (value.length > MAX_CLEAN_TRANSCRIPT_WORDS) return null;

  const words: CleanTranscriptWord[] = [];
  let characters = 0;
  for (const entry of value) {
    if (!entry || typeof entry !== "object") return null;
    const text = (entry as Record<string, unknown>).text;
    if (
      typeof text !== "string" ||
      !text.trim() ||
      text.length > MAX_CLEAN_TRANSCRIPT_WORD_CHARS
    ) {
      return null;
    }
    characters += text.length;
    if (characters > MAX_CLEAN_TRANSCRIPT_CHARS) return null;
    const { start, end } = entry as Record<string, unknown>;
    const timed =
      typeof start === "number" &&
      typeof end === "number" &&
      Number.isFinite(start) &&
      Number.isFinite(end) &&
      start >= 0 &&
      end >= start;
    words.push(timed ? { text, start, end } : { text });
  }
  return words;
}
