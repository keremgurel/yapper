import type {
  TrainingCorrection,
  TranscriptWord,
} from "@/lib/training-feedback/types";

/** One run of transcript text, either plain or owned by a correction. */
export interface TranscriptSegment {
  text: string;
  /** Index into the corrections array, or null for plain text. */
  correctionIndex: number | null;
}

/**
 * Splits the spoken transcript into segments so the result screen can mark
 * corrected spans inline. Corrections carry the verbatim span and, usually,
 * a start time; the time narrows the search so a repeated phrase marks the
 * occurrence that was actually flagged. A correction whose span cannot be
 * found in the text is simply not annotated; callers can surface the
 * leftovers separately via `unmatchedCorrections`.
 */
export function annotateTranscript(
  words: TranscriptWord[],
  corrections: TrainingCorrection[],
): TranscriptSegment[] {
  const fullText = words.map((w) => w.text).join(" ");
  if (!fullText) return [];
  const lower = fullText.toLowerCase();

  // Char offset where each word starts, for timestamp-guided matching.
  const offsets: number[] = [];
  let at = 0;
  for (const w of words) {
    offsets.push(at);
    at += w.text.length + 1;
  }

  const spans: { start: number; end: number; correctionIndex: number }[] = [];
  let cursor = 0;
  corrections.forEach((c, i) => {
    const needle = c.original.trim().toLowerCase();
    if (!needle) return;
    let from = cursor;
    const startSec = c.start;
    if (startSec != null) {
      const wordIdx = words.findIndex((w) => w.end > startSec);
      if (wordIdx >= 0) from = Math.max(0, offsets[wordIdx] - 1);
    }
    let idx = lower.indexOf(needle, from);
    if (idx === -1) idx = lower.indexOf(needle);
    if (idx === -1) return;
    spans.push({ start: idx, end: idx + needle.length, correctionIndex: i });
    cursor = Math.max(cursor, idx + needle.length);
  });

  spans.sort((a, b) => a.start - b.start);

  const segments: TranscriptSegment[] = [];
  let pos = 0;
  for (const s of spans) {
    // Overlapping matches keep the earlier span so the text renders once.
    if (s.start < pos) continue;
    if (s.start > pos) {
      segments.push({
        text: fullText.slice(pos, s.start),
        correctionIndex: null,
      });
    }
    segments.push({
      text: fullText.slice(s.start, s.end),
      correctionIndex: s.correctionIndex,
    });
    pos = s.end;
  }
  if (pos < fullText.length) {
    segments.push({ text: fullText.slice(pos), correctionIndex: null });
  }
  return segments;
}

/** Corrections that `annotateTranscript` could not anchor to the text. */
export function unmatchedCorrections(
  segments: TranscriptSegment[],
  corrections: TrainingCorrection[],
): TrainingCorrection[] {
  const matched = new Set(
    segments.map((s) => s.correctionIndex).filter((i) => i !== null),
  );
  return corrections.filter((_, i) => !matched.has(i));
}
