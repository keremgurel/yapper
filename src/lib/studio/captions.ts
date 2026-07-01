import { clipIndexAtSource, sourceToTimeline } from "@/lib/studio/clips";
import {
  newCaptionId,
  type Caption,
  type Clip,
  type Word,
} from "@/lib/studio/types";

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

export const DEFAULT_CAPTION_STYLE: CaptionStyle = {
  fontFamily: CAPTION_FONTS[0].stack,
  fontScale: 0.04,
  width: 0.9,
  x: 0.5,
  y: 0.82,
};

const endsSentence = (t: string) => /[.?!]$/.test(t.trim());

/**
 * Build caption segments from the transcript. Only kept (non-cut) words are
 * used, and their source times are mapped to edited-timeline seconds, so
 * captions line up with the final video. Words are grouped until a caption
 * would exceed `maxChars`, a sentence ends, or there's a real pause.
 */
export function generateCaptions(
  words: Word[],
  clips: Clip[],
  maxChars = 2 * CHARS_PER_LINE,
): Caption[] {
  const kept = words.filter(
    (w) => clipIndexAtSource(clips, (w.start + w.end) / 2) !== -1,
  );
  const captions: Caption[] = [];
  let cur: Caption | null = null;
  let prevEndTl = 0;
  for (const w of kept) {
    // Timeline gap only drives where captions break (edited pauses); the caption
    // itself is anchored in source time so it follows later edits.
    const ts = sourceToTimeline(clips, w.start);
    const wouldExceed =
      cur !== null && cur.text.length + 1 + w.text.length > maxChars;
    const pause = cur !== null && ts - prevEndTl > 0.5;
    if (cur === null || wouldExceed || pause) {
      if (cur) captions.push(cur);
      cur = {
        id: newCaptionId(),
        text: w.text,
        sourceStart: w.start,
        sourceEnd: w.end,
      };
    } else {
      cur.text += ` ${w.text}`;
      cur.sourceEnd = w.end;
    }
    prevEndTl = sourceToTimeline(clips, w.end);
    if (cur && endsSentence(w.text) && cur.text.length > maxChars * 0.5) {
      captions.push(cur);
      cur = null;
    }
  }
  if (cur) captions.push(cur);
  return captions;
}
