import { speechBoundsInRange, type TrimAnalysis } from "@/lib/studio/silence";
import type { Clip } from "@/lib/studio/types";

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
