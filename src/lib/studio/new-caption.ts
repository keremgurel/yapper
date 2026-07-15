import { timelineToSource } from "@/lib/studio/clips";
import { newCaptionId, type Caption, type Clip } from "@/lib/studio/types";

const DEFAULT_LEN = 1.8; // a comfortable default caption length, seconds
const MIN_LEN = 0.3; // never create a sliver
const GAP = 0.02; // hair of space before the next caption

/**
 * The caption created when the user adds one at the timeline playhead.
 *
 * Anchored in RECORDING source time via `timelineToSource`, not the raw playhead
 * or the currently-playing clip's own clock: a caption added while parked over
 * an appended b-roll clip must land on a real recording moment (the cut), not
 * the b-roll file's timestamp, which would place it somewhere unrelated. The end
 * runs a short default unless the next caption starts sooner, in which case it
 * stops just before it so the two never overlap. Pure.
 */
export function newCaptionAtTimeline(
  clips: Clip[],
  captions: Caption[],
  timelineTime: number,
): Caption {
  const start = Math.max(0, timelineToSource(clips, timelineTime));
  let end = start + DEFAULT_LEN;
  const nextStart = captions
    .map((c) => c.sourceStart)
    .filter((s) => s > start)
    .sort((a, b) => a - b)[0];
  if (nextStart !== undefined && nextStart < end) {
    end = Math.max(start + MIN_LEN, nextStart - GAP);
  }
  return {
    id: newCaptionId(),
    text: "New caption",
    sourceStart: start,
    sourceEnd: end,
  };
}
