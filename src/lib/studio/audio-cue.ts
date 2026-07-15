import type { AudioTrack } from "@/lib/studio/types";

/** What a hidden preview <audio> should be doing at a given master-clock time. */
export interface AudioCue {
  /** Whether the track should be audibly playing right now. */
  active: boolean;
  /** The media file position (element.currentTime) it should sit at, in
   * seconds. Only meaningful while `active`. */
  target: number;
}

/**
 * Decide how one audio track follows the master (edited-timeline) clock during
 * preview. The clip plays media [sourceStart, sourceStart + duration) over the
 * timeline span [start, start + duration), so the file position is the clip's
 * in-point plus how far the playhead has advanced into the clip, NOT the raw
 * distance from the timeline origin. Trimmed and split clips carry a non-zero
 * in-point, so dropping it plays the wrong seconds. Pure, so preview and the
 * offline export mix agree on the same math.
 */
export function audioCue(
  track: AudioTrack,
  masterTime: number,
  playing: boolean,
): AudioCue {
  const local = masterTime - track.start;
  const active =
    playing && !track.muted && local >= 0 && local < track.duration;
  return { active, target: track.sourceStart + local };
}
