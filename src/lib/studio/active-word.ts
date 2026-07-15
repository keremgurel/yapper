import { timelineToSource } from "@/lib/studio/clips";
import type { Clip, Word } from "@/lib/studio/types";

/**
 * The transcript word under the playhead, or null.
 *
 * The playhead is an edited-timeline position, but words live in RECORDING
 * source time, so it maps through `timelineToSource` first. Over an appended
 * b-roll clip that maps to the cut, keeping the highlight on a real recording
 * word instead of lighting up a coincidental one at the b-roll's own timestamp.
 * The scan runs from the end so, when word timings overlap, the later word wins
 * and only one lights up. Pure.
 */
export function activeWordId(
  words: Word[],
  clips: Clip[],
  timelineTime: number,
): string | null {
  const src = timelineToSource(clips, timelineTime);
  for (let i = words.length - 1; i >= 0; i--) {
    const w = words[i];
    if (src >= w.start && src <= w.end) return w.id;
  }
  return null;
}
