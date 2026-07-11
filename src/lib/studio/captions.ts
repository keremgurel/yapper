import { clipIndexAtSource, sourceToTimeline } from "@/lib/studio/clips";
import {
  newCaptionId,
  type Caption,
  type CaptionCase,
  type Clip,
  type Word,
} from "@/lib/studio/types";

export type { CaptionCase } from "@/lib/studio/types";

/** A caption's edited-timeline range, derived from its source anchors + clips. */
export function captionTimelineRange(
  clips: Clip[],
  c: Caption,
): { start: number; end: number } {
  return {
    start: sourceToTimeline(clips, c.sourceStart),
    end: sourceToTimeline(clips, c.sourceEnd),
  };
}

export interface CaptionStyle {
  fontFamily: string;
  fontScale: number; // fraction of stage height
  width: number; // box width, fraction of stage width
  x: number; // center x, fraction of stage
  y: number; // center y, fraction of stage
  textCase: CaptionCase; // display-only casing, fully revertible
}

/** CSS text-transform for a caption case mode. */
export function caseTransform(
  c: CaptionCase,
): "none" | "lowercase" | "uppercase" {
  return c === "lower" ? "lowercase" : c === "upper" ? "uppercase" : "none";
}

/** A few elegant, dependency-free font presets for captions. */
export const CAPTION_FONTS = [
  {
    id: "modern",
    label: "Modern",
    stack: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  },
  {
    id: "classic",
    label: "Classic",
    stack: 'Georgia, "Times New Roman", serif',
  },
  {
    id: "round",
    label: "Round",
    stack:
      'ui-rounded, "SF Pro Rounded", "Hiragino Maru Gothic ProN", sans-serif',
  },
] as const;

export const CHARS_PER_LINE = 30;

// Transcriber word starts lag the true acoustic onset by ~0.1-0.2s, so a caption
// anchored exactly at its first word reads slightly late. Give each caption a
// small head-start into the silent gap before it (never crossing the previous
// word), so it appears right as the words are spoken.
const CAPTION_LEAD_SEC = 0.12;

export const DEFAULT_CAPTION_STYLE: CaptionStyle = {
  fontFamily: CAPTION_FONTS[0].stack,
  fontScale: 0.04,
  width: 0.9,
  x: 0.5,
  y: 0.82,
  textCase: "none",
};

const endsSentence = (t: string) => /[.?!]$/.test(t.trim());

export interface CaptionGroupOptions {
  /** Character budget per caption (phrase mode). */
  maxChars?: number;
  /** Fixed number of words per caption (0 = phrase mode). */
  maxWords?: number;
}

/**
 * Build caption segments from the transcript. Only kept (non-cut) words are
 * used, and their source times are mapped to edited-timeline seconds, so
 * captions line up with the final video.
 *
 * In phrase mode (maxWords = 0) words are grouped until a caption would exceed
 * `maxChars`, a sentence ends, or there's a real pause. With `maxWords` set,
 * captions are exactly that many words (still breaking on real pauses), which
 * gives the CapCut-style "N words at a time" look.
 */
export function generateCaptions(
  words: Word[],
  clips: Clip[],
  opts: CaptionGroupOptions = {},
): Caption[] {
  const maxChars = opts.maxChars ?? 2 * CHARS_PER_LINE;
  const maxWords = opts.maxWords ?? 0;
  const kept = words.filter(
    (w) => clipIndexAtSource(clips, (w.start + w.end) / 2) !== -1,
  );
  const captions: Caption[] = [];
  let cur: Caption | null = null;
  let curWords = 0;
  let prevEndTl = 0;
  let prevWordEnd = 0; // source end of the previous kept word
  for (const w of kept) {
    // Timeline gap only drives where captions break (edited pauses); the caption
    // itself is anchored in source time so it follows later edits.
    const ts = sourceToTimeline(clips, w.start);
    const pause = cur !== null && ts - prevEndTl > 0.5;
    const full =
      maxWords > 0
        ? cur !== null && curWords >= maxWords
        : cur !== null && cur.text.length + 1 + w.text.length > maxChars;
    if (cur === null || pause || full) {
      if (cur) captions.push(cur);
      cur = {
        id: newCaptionId(),
        // Lead into the silent gap before the first word, never past the
        // previous word's end, so the caption is on time but never overlaps it.
        sourceStart: Math.max(prevWordEnd, w.start - CAPTION_LEAD_SEC),
        text: w.text,
        sourceEnd: w.end,
      };
      curWords = 1;
    } else {
      cur.text += ` ${w.text}`;
      cur.sourceEnd = w.end;
      curWords += 1;
    }
    prevEndTl = sourceToTimeline(clips, w.end);
    prevWordEnd = w.end;
    // Flush on sentence end only in phrase mode; word mode is strictly N words.
    if (
      maxWords === 0 &&
      cur &&
      endsSentence(w.text) &&
      cur.text.length > maxChars * 0.5
    ) {
      captions.push(cur);
      cur = null;
      curWords = 0;
    }
  }
  if (cur) captions.push(cur);
  return captions;
}
