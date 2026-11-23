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
 * The 1,399 word take is itself cut off at 8,000 about one call in four now
 * (20 of 81). It keeps 8,000 because the other three finish in a minute where
 * 12,000 takes a minute and a half on every call; the fourth is asked again
 * with more room. Takes of 468 and 619 words never came near the cap.
 */

/** What the 1,399 word take was measured with. Shorter takes keep it. */
const FLOOR = 8_000;
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
