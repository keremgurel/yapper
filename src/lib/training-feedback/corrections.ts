/**
 * Resolve model-returned correction spans onto the transcript word array. The
 * model addresses spans by word index against the tokenized transcript it was
 * shown; this turns those into verbatim text plus timestamps, and silently
 * drops anything the model got wrong about the geometry. A bad span is the
 * model's error, not the user's, so it costs an annotation rather than the
 * whole result.
 */

import type { FeedbackWord } from "@/lib/feedback/metrics";
import type { CorrectionType, TrainingCorrection } from "./types";

/** A correction exactly as the model emits it, after sanitization but before
 * span resolution. */
export interface ModelCorrection {
  type: CorrectionType;
  wordIndex: number;
  wordCount: number;
  fix: string | null;
  note: string | null;
}

export function resolveCorrections(
  corrections: ModelCorrection[],
  words: FeedbackWord[],
): TrainingCorrection[] {
  const inRange = corrections.filter(
    (c) =>
      Number.isInteger(c.wordIndex) &&
      Number.isInteger(c.wordCount) &&
      c.wordIndex >= 0 &&
      c.wordCount >= 1 &&
      c.wordIndex + c.wordCount <= words.length,
  );
  inRange.sort((a, b) => a.wordIndex - b.wordIndex);

  const resolved: TrainingCorrection[] = [];
  // End of the last accepted span, exclusive. Overlapping spans keep the
  // earlier one; the prompt forbids overlaps, so a violation is model noise.
  let nextFree = 0;
  for (const c of inRange) {
    if (c.wordIndex < nextFree) continue;
    const span = words.slice(c.wordIndex, c.wordIndex + c.wordCount);
    resolved.push({
      type: c.type,
      original: span.map((w) => w.text).join(" "),
      fix: c.fix,
      note: c.note,
      start: span[0].start,
      end: span[span.length - 1].end,
    });
    nextFree = c.wordIndex + c.wordCount;
  }
  return resolved;
}
