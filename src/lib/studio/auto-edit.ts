import { fullClip, removeSourceRange } from "@/lib/studio/clips";
import { speechBoundsInRange, type TrimAnalysis } from "@/lib/studio/silence";
import {
  combineRetakeCuts,
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

/**
 * The one-click pass, as the progress UI names its stages. Decoding and
 * transcription are the caller's; the rest is `planAutoEdit`.
 */
export const AUTO_EDIT_STEPS = {
  PREPARE: 0,
  TRANSCRIPT: 1,
  RETAKES: 2,
  SILENCE: 3,
  TRIM: 4,
  CAPTIONS: 5,
} as const;

/** The one-click pass cuts tighter than "remove pauses": it reshapes the take. */
const AUTO_EDIT_CUTS: PauseCutOptions = {
  minGap: 0.25,
  minSilence: 0.4,
  headPad: 0.04,
  tailPad: 0.15,
};

export interface AutoEditInput {
  clips: Clip[];
  /** Empty when there is no transcript; the pass then only trims silence. */
  words: Word[];
  /** What the video element claims. Often short, for MediaRecorder WebM. */
  sourceDuration: number;
  /** What the decoded audio says, which is the honest answer. */
  audioDuration: number;
  /** null when the waveform could not be analysed: clips are left untrimmed. */
  analysis: TrimAnalysis | null;
  /** Word-INDEX pairs from the AI retake pass, not seconds. null when it failed. */
  aiCuts: [number, number][] | null;
  onStep?: (step: number) => void;
}

export interface AutoEditResult {
  clips: Clip[];
  /** The take's true length, which the caller writes back to the source. */
  duration: number;
}

/**
 * Everything the one-click pass does to the clips, given its inputs. Pure, so
 * each stage sees the previous stage's clips directly rather than waiting on a
 * React state flush, and so the whole pass can be tested without a browser.
 *
 * The caller owns the slow, impure half: decoding the audio, transcribing it,
 * and asking the backend which lines are retakes. It reports steps 0 and 1 (and
 * step 2, which spans the retake network call); `onStep` covers the rest.
 */
export function planAutoEdit({
  clips,
  words,
  sourceDuration,
  audioDuration,
  analysis,
  aiCuts,
  onStep,
}: AutoEditInput): AutoEditResult {
  const duration = Math.max(sourceDuration, audioDuration);

  // Speech past the video element's reported duration is real. Stretch the
  // timeline to reach it, but only when the user has not cut anything yet:
  // rewriting an edited timeline would throw their work away.
  const pristine =
    clips.length === 1 &&
    clips[0].start <= 0.001 &&
    clips[0].end >= sourceDuration - 0.1;
  const extend = pristine && audioDuration > sourceDuration + 0.1;
  const original = extend ? fullClip(duration) : clips;

  let next = original;
  const cut = (ranges: [number, number][]) => {
    for (const [from, to] of ranges) next = removeSourceRange(next, from, to);
  };

  if (words.length > 0) {
    onStep?.(AUTO_EDIT_STEPS.RETAKES);
    cut(combineRetakeCuts(words, aiCuts));

    onStep?.(AUTO_EDIT_STEPS.SILENCE);
    cut([...fillerCuts(words), ...pauseCuts(words, duration, AUTO_EDIT_CUTS)]);
  }

  onStep?.(AUTO_EDIT_STEPS.TRIM);
  if (analysis) next = trimClipsToSpeech(next, analysis);
  next = dropSlivers(next);

  // Cutting everything means the analysis disagreed with the transcript. Give
  // the take back rather than handing over an empty timeline.
  if (next.length === 0) next = original;

  return { clips: next, duration };
}
