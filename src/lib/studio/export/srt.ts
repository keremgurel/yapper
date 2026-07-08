import { clipIndexAtSource, sourceToTimeline } from "@/lib/studio/clips";
import type { Caption, CaptionCase, Clip } from "@/lib/studio/types";

function pad(n: number, width = 2): string {
  return Math.floor(n).toString().padStart(width, "0");
}

/** Format seconds as an SRT timestamp: HH:MM:SS,mmm. */
function srtTime(seconds: number): string {
  const ms = Math.round(seconds * 1000);
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(ms % 1000, 3)}`;
}

function applyCase(text: string, mode: CaptionCase | undefined): string {
  if (mode === "upper") return text.toUpperCase();
  if (mode === "lower") return text.toLowerCase();
  return text;
}

/**
 * Build an .srt subtitle file from the captions, with timings in EDITED-timeline
 * time (the export is the cut video, not the source). Captions that fall in a
 * removed region are skipped, and each caption's own case override wins over the
 * global one — so the file matches what plays in the exported video.
 */
export function captionsToSrt(
  captions: Caption[],
  clips: Clip[],
  globalCase?: CaptionCase,
): string {
  const cues = captions
    .filter(
      (c) => clipIndexAtSource(clips, (c.sourceStart + c.sourceEnd) / 2) !== -1,
    )
    .map((c) => ({
      start: sourceToTimeline(clips, c.sourceStart),
      end: sourceToTimeline(clips, c.sourceEnd),
      text: applyCase(c.text.trim(), c.textCase ?? globalCase),
    }))
    .filter((c) => c.end > c.start && c.text.length > 0)
    .sort((a, b) => a.start - b.start);

  return cues
    .map(
      (c, i) =>
        `${i + 1}\n${srtTime(c.start)} --> ${srtTime(c.end)}\n${c.text}\n`,
    )
    .join("\n");
}
