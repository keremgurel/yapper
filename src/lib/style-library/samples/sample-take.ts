import type { TimedWord } from "../format/content-spec";
import { STAND_IN_SCREEN } from "./stand-in-screen";

/**
 * What every preview is drawn on. All of it is made for the library: a
 * generated still of a presenter who does not exist, a drawn screen and a
 * made-up line. No creator's footage or numbers.
 *
 * The still stands in for a take. A path is relative to the host's public
 * folder (`public/style-samples/` in the web app, linked into the runner).
 */
export const SAMPLE_TAKE = "style-samples/speaker.jpg";
export const SAMPLE_FRAME = SAMPLE_TAKE;
export const SAMPLE_CLIP = STAND_IN_SCREEN;
export const SAMPLE_SCREENSHOT = STAND_IN_SCREEN;

const LINE =
  "This is where your words show. Two or three at a time, right as you say them. Change the look and they follow.";
const SECONDS_PER_WORD = 0.27;

/** The sample line with even timing, about the pace of someone talking to camera. */
export const SAMPLE_WORDS: TimedWord[] = LINE.split(" ").map((text, index) => ({
  text,
  start: Number((index * SECONDS_PER_WORD).toFixed(2)),
  end: Number(((index + 1) * SECONDS_PER_WORD).toFixed(2)),
}));
