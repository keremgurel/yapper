import {
  BOUNDARY,
  fillerMoments,
  LONG_PAUSE,
  PAUSE,
} from "@/lib/feedback/metrics";
import type { TranscriptWord } from "@/lib/training-feedback/types";

export interface TimelineSpan {
  /** Position and width as fractions of the whole recording, 0 to 1. */
  left: number;
  width: number;
}
export interface TimelinePause extends TimelineSpan {
  seconds: number;
  /** Fell inside a sentence instead of at its end. */
  midSentence: boolean;
  long: boolean;
  /** The word spoken just before the silence. */
  after: string;
}
export interface TimelineFiller {
  at: number;
  word: string;
}
export interface SpeechTimelineModel {
  durationSec: number;
  speech: TimelineSpan[];
  pauses: TimelinePause[];
  fillers: TimelineFiller[];
}

/**
 * Lay a recording out on a line: stretches of speech, the silences between
 * them, and the moment each filler was said. Positions are fractions of the
 * recording so the drawing scales to any width. Null when there are no
 * timings to draw.
 */
export function buildSpeechTimeline(
  words: TranscriptWord[],
): SpeechTimelineModel | null {
  const timed = words.filter(
    (w) =>
      Number.isFinite(w.start) && Number.isFinite(w.end) && w.end > w.start,
  );
  if (timed.length < 2) return null;
  const origin = timed[0].start;
  const durationSec = timed[timed.length - 1].end - origin;
  if (durationSec <= 0) return null;
  const at = (seconds: number) => (seconds - origin) / durationSec;

  const speech: TimelineSpan[] = [];
  const pauses: TimelinePause[] = [];
  let runStart = timed[0].start;
  for (let i = 1; i < timed.length; i++) {
    const previous = timed[i - 1];
    const gap = timed[i].start - previous.end;
    if (gap < PAUSE) continue;
    speech.push({ left: at(runStart), width: at(previous.end) - at(runStart) });
    pauses.push({
      left: at(previous.end),
      width: gap / durationSec,
      seconds: Math.round(gap * 10) / 10,
      midSentence: !BOUNDARY.test(previous.text.trim()),
      long: gap >= LONG_PAUSE,
      after: previous.text,
    });
    runStart = timed[i].start;
  }
  const last = timed[timed.length - 1];
  speech.push({ left: at(runStart), width: at(last.end) - at(runStart) });

  return {
    durationSec,
    speech,
    pauses,
    fillers: fillerMoments(timed).map((filler) => ({
      at: at((filler.start + filler.end) / 2),
      word: filler.word,
    })),
  };
}
