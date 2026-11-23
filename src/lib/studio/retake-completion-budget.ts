/**
 * How many completion tokens the retake call may spend on a take.
 *
 * The answer itself is small, about 200 to 350 tokens. The allowance is for
 * thinking: Gemini counts hidden thinking against the same cap, and it thinks
 * for longer on a longer take. A fixed 8,000 was sized on a 1,399 word take.
 * On a 2,892 word take (24.6 minutes, measured 2026-11-23) 8 calls in 31 were
 * cut off at 8,000 and none in 28 at 16,000, which is 5.5 tokens a word.
 *
 * It is not simply set high for every take, because on a long take the model
 * uses the room it is given and the call slows down with it: about 60 seconds
 * at 8,000, 105 at 16,000 and 210 at 32,000, with nothing gained in the cut
 * past 16,000.
 *
 * No take starts below 12,000. The 1,399 word take was cut off at 8,000 about
 * one call in four (20 of 81), and each of those cost a second call, about
 * 160 seconds in all against 80. At 12,000 none of 20 was cut off and a call
 * took about 85 seconds, so the wait is much the same on average and no
 * longer doubles one time in four. Takes of 468 and 619 words finish in 35 to
 * 41 seconds at either figure, so the higher floor costs them nothing.
 */

/** Where the 1,399 word take stopped being cut off. Shorter takes share it. */
const FLOOR = 12_000;
/** About 210 seconds of thinking, the most that fits in the route's time. */
const CEILING = 32_000;
const TOKENS_PER_WORD = 5.5;
const STEP = 1_000;
/** How much more room a call gets after its answer was cut off. */
const GROWTH = 1.5;

function roundedUp(tokens: number): number {
  return Math.ceil(tokens / STEP) * STEP;
}

/** The allowance for the first call on a take of this many words. */
export function retakeCompletionBudget(wordCount: number): number {
  const scaled = roundedUp(wordCount * TOKENS_PER_WORD);
  return Math.min(CEILING, Math.max(FLOOR, scaled));
}

/**
 * The allowance for asking again after an answer was cut off, or null when
 * the call already had all the room there is.
 */
export function roomierCompletionBudget(budget: number): number | null {
  const roomier = Math.min(CEILING, roundedUp(budget * GROWTH));
  return roomier > budget ? roomier : null;
}
