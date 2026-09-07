import type { PublishPlatform } from "@/lib/db/schema";

/** One credit buys three minutes of transcription, rounded up. */
export const SECONDS_PER_UNIT = 180;
/** The most one video may cost. Longer videos are refused before any charge. */
export const MAX_UNITS = 8;
export const MAX_SAMPLE_SECONDS = SECONDS_PER_UNIT * MAX_UNITS;

/**
 * Credits for transcribing a video of this length.
 *
 * Unknown length (Instagram does not report one) is billed as one unit up
 * front and settled from the length the transcriber actually heard.
 */
export function transcriptionUnits(durationSec: number | null): number {
  if (durationSec === null || !Number.isFinite(durationSec) || durationSec <= 0)
    return 1;
  return Math.min(
    MAX_UNITS,
    Math.max(1, Math.ceil(durationSec / SECONDS_PER_UNIT)),
  );
}

/**
 * What a voice sample from this platform costs. YouTube ships captions with
 * the video, so reading them costs nothing; the others are transcribed.
 */
export function sampleCredits(
  platform: PublishPlatform,
  durationSec: number | null,
): number {
  if (platform === "youtube") return 0;
  return transcriptionUnits(durationSec);
}

export function tooLong(durationSec: number | null): boolean {
  return durationSec !== null && durationSec > MAX_SAMPLE_SECONDS;
}
