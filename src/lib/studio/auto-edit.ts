import { speechBoundsInRange, type TrimAnalysis } from "@/lib/studio/silence";
import {
  findFillerIds,
  pauseRanges,
  selectionToRanges,
} from "@/lib/studio/transcript-edit";
import type { Clip, Word } from "@/lib/studio/types";

/** A span of the recording's seconds, to be cut out of the timeline. */
export type SourceRange = [number, number];

/**
 * Clips shorter than this are the leftover slivers of cut retakes and pauses.
 * They make playback stutter instead of cut cleanly.
 */
export const MIN_CLIP_SEC = 0.08;

export interface PauseCutOptions {
  /** A gap between two words counts as a pause once it reaches this. */
  minGap: number;
  /** Silence at the head or tail is only worth cutting once it reaches this. */
  minSilence: number;
  /** Leave this much silence before the first word. */
  headPad: number;
  /** Leave this much after the last word: a soft final syllable decays slowly. */
  tailPad: number;
}

/** Keep a breath of room around the speech so words aren't clipped short. */
const LEAD_PAD = 0.05;
const TAIL_PAD = 0.08;

/** A trim that would leave less than this isn't a trim, it's a deletion. */
const MIN_TRIMMED_SEC = 0.1;

/**
 * Pull each clip's edges in to the speech inside it, so a run of clips begins
 * and ends on words rather than silence.
 *
 * The analysis is of the project's RECORDING, and its frames are indexed by the
 * recording's seconds. A clip carrying its own media counts seconds into a
 * different file entirely, so it is left alone: trimming it against these
 * frames would cut b-roll to where the speaker happens to pause.
 *
 * A clip that needs no trimming is returned by identity, so callers can count
 * what actually changed.
 */
export function trimClipsToSpeech(
  clips: Clip[],
  analysis: TrimAnalysis,
): Clip[] {
  return clips.map((c) => {
    if (c.src != null) return c;
    const bounds = speechBoundsInRange(analysis, c.start, c.end);
    if (!bounds) return c; // no speech in this clip, nothing to trim to
    const start = Math.max(c.start, bounds.start - LEAD_PAD);
    const end = Math.min(c.end, bounds.end + TAIL_PAD);
    if (end - start < MIN_TRIMMED_SEC) return c;
    if (start === c.start && end === c.end) return c;
    return { ...c, start, end };
  });
}

/**
 * The silence worth cutting: the gaps between words, plus the dead air before
 * the first word and after the last. Never touches speech.
 *
 * The thresholds are the caller's, because the two callers want different ones.
 * "Remove pauses" is conservative, since the user asked for exactly this one
 * thing. The one-click auto-edit is more aggressive, since it is already
 * reshaping the whole take and a tighter cut is the point.
 */
export function pauseCuts(
  words: Word[],
  duration: number,
  { minGap, minSilence, headPad, tailPad }: PauseCutOptions,
): SourceRange[] {
  if (words.length === 0) return [];
  const ranges = pauseRanges(words, minGap);
  const first = words[0];
  const last = words[words.length - 1];
  if (first.start >= minSilence) ranges.unshift([0, first.start - headPad]);
  if (duration - last.end >= minSilence)
    ranges.push([last.end + tailPad, duration]);
  return ranges;
}

/** Filler words ("um", "uh", ...) as source ranges, adjacent ones merged. */
export function fillerCuts(words: Word[]): SourceRange[] {
  return selectionToRanges(words, new Set(findFillerIds(words)));
}

/** Drop the clips too short to play cleanly. */
export function dropSlivers(clips: Clip[], minSec = MIN_CLIP_SEC): Clip[] {
  return clips.filter((c) => c.end - c.start >= minSec);
}
