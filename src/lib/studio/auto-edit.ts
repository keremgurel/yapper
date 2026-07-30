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
/** Padding islands this short contain no spoken word and only add a seek. */
export const MIN_SPEECHLESS_CLIP_SEC = 0.35;

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
  words: Word[] = [],
): Clip[] {
  return clips.map((c) => {
    if (c.src != null) return c;
    const bounds = speechBoundsInRange(analysis, c.start, c.end);
    if (!bounds) return c; // no speech in this clip, nothing to trim to
    let start = Math.max(c.start, bounds.start - LEAD_PAD);
    let end = Math.min(c.end, bounds.end + TAIL_PAD);
    // VAD can miss a quiet sentence starter ("so", "and", "I") even while ASR
    // correctly found it. A waveform trim must never override the transcript
    // and eat a word that the edit intentionally kept.
    const keptWords = words.filter((word) => {
      const midpoint = (word.start + word.end) / 2;
      return midpoint >= c.start && midpoint <= c.end;
    });
    if (keptWords.length > 0) {
      start = Math.min(start, Math.max(c.start, keptWords[0].start - LEAD_PAD));
      end = Math.max(
        end,
        Math.min(c.end, keptWords[keptWords.length - 1].end + TAIL_PAD),
      );
    }
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
  const ranges = pauseRanges(words, minGap)
    .map(([from, to]) => [from + tailPad, to - headPad] as [number, number])
    .filter(([from, to]) => to > from);
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
 * Drop short recording islands that contain no transcript word.
 *
 * AI ranges and pause padding can overlap in a way that leaves ~150ms of
 * neither speech nor useful room tone between two cuts. Those islands create
 * an extra clip boundary (and an audible hiccup) without preserving content.
 * Short clips containing even one word are kept: duration alone must never
 * erase a quiet starter such as "so", "and", or "to".
 */
export function dropSpeechlessSlivers(
  clips: Clip[],
  words: Word[],
  minSec = MIN_SPEECHLESS_CLIP_SEC,
): Clip[] {
  if (words.length === 0) return clips;
  return clips.filter((clip) => {
    if (clip.src != null || clip.end - clip.start >= minSec) return true;
    return words.some((word) => {
      const midpoint = (word.start + word.end) / 2;
      return midpoint >= clip.start && midpoint <= clip.end;
    });
  });
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

/** One-click editing must never proceed on a failed or empty transcript. */
export function hasUsableAutoEditTranscript(
  words: Word[] | null,
): words is Word[] {
  return words !== null && words.length > 0;
}

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
  let keptWords = words;

  if (words.length > 0) {
    onStep?.(AUTO_EDIT_STEPS.RETAKES);
    const retakeCuts = combineRetakeCuts(words, aiCuts);
    cut(retakeCuts);
    // Every later stage must reason about the EDIT, not the raw recording.
    // Treating words inside a deleted retake as still present leaves padding
    // around the removed take and protects tiny speechless islands from being
    // dropped — producing both audible pauses and needless clip boundaries.
    keptWords = words.filter((word) => {
      const midpoint = (word.start + word.end) / 2;
      return !retakeCuts.some(
        ([from, to]) => midpoint >= from && midpoint <= to,
      );
    });

    onStep?.(AUTO_EDIT_STEPS.SILENCE);
    cut([
      ...fillerCuts(keptWords),
      ...pauseCuts(keptWords, duration, AUTO_EDIT_CUTS),
    ]);
  }

  onStep?.(AUTO_EDIT_STEPS.TRIM);
  if (analysis) next = trimClipsToSpeech(next, analysis, keptWords);
  next = dropSlivers(next);
  next = dropSpeechlessSlivers(next, keptWords);

  // Cutting everything means the analysis disagreed with the transcript. Give
  // the take back rather than handing over an empty timeline.
  if (next.length === 0) next = original;

  return { clips: next, duration };
}
