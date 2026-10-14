import type { CleanTranscriptWord } from "@/lib/studio/clean-transcript-input";

/** What one 1-Click Edit read and what it took out. */
export interface EditRunMeasure {
  /** From the first word to the last, when the words carry timings. */
  footageSeconds: number;
  cutCount: number;
  /** Seconds of speech the cuts removed, when the words carry timings. */
  cutSeconds: number;
  wordCount: number;
}

/**
 * Cutting by hand means watching the footage at least once and then making
 * each cut: finding it, setting in and out, deleting and checking the join.
 * Twenty seconds a cut is a brisk editor's pace for talking-head footage.
 */
export const SECONDS_PER_MANUAL_CUT = 20;

/** Measures one edit from the words it read and the word spans it cut.
 * Untimed words still count their cuts; only the seconds are left at zero. */
export function measureEditRun(
  words: CleanTranscriptWord[],
  cuts: [number, number][],
): EditRunMeasure {
  const first = words[0]?.start;
  const last = words.at(-1)?.end;
  const footageSeconds =
    typeof first === "number" && typeof last === "number" && last > first
      ? last - first
      : 0;
  let cutSeconds = 0;
  for (const [start, end] of cuts) {
    const from = words[start]?.start;
    const to = words[end]?.end;
    if (typeof from === "number" && typeof to === "number" && to > from)
      cutSeconds += to - from;
  }
  return {
    footageSeconds,
    cutCount: cuts.length,
    cutSeconds,
    wordCount: words.length,
  };
}

/** Time saved against cutting it yourself: one watch of the footage, plus
 * the hand time for every cut. */
export function timeSavedSeconds(totals: {
  footageSeconds: number;
  cutCount: number;
}): number {
  return totals.footageSeconds + totals.cutCount * SECONDS_PER_MANUAL_CUT;
}
