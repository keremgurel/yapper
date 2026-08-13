export interface CleanTranscriptWord {
  text: string;
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
    words.push({ text });
  }
  return words;
}
