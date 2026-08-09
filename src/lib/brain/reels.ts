/**
 * The slot machine's reels.
 *
 * A blank "give me an idea" button asks the model to pick a topic, an angle and
 * a shape all at once, and it answers with the middle of the distribution every
 * time: the same safe listicle in a different hat. Spinning three reels first
 * moves the choosing out of the model and into chance, so the model's only job
 * is to write the idea it was dealt. That is what makes two pulls feel
 * genuinely different rather than reworded.
 *
 * Pure and dependency-free: the randomness is injected, so a spin can be
 * reproduced in a test.
 */

/** How the idea is told. */
export const ANGLE_REEL = [
  "a mistake you made and what it cost",
  "a belief in your niche that is quietly wrong",
  "the thing everyone gets told, and what actually works",
  "a before and after, with the number that changed",
  "the question you get asked most, answered properly",
  "what you would do if you were starting over today",
  "a comparison: two ways to do it, one clearly better",
  "the part nobody warns you about",
  "a tiny detail that changes the whole result",
  "someone else's result, broken down into steps",
] as const;

/** What it looks like on screen. Overridden by the creator's own formats when
 * they have written any down. */
export const FORMAT_REEL = [
  "talking head, one idea, under 40 seconds",
  "talking head with b-roll cutaways on every claim",
  "a list with an on-screen counter",
  "a story, told straight through, no list",
  "a demo: show it happening rather than describe it",
  "a reaction to a screenshot or a clip",
] as const;

export interface SpinCombination {
  /** One of the creator's pillars, or "" when they have none yet. */
  pillar: string;
  angle: string;
  format: string;
}

export interface SpinReels {
  pillars: string[];
  /** The creator's own formats, if their brain lists any. */
  formats: string[];
}

/** `random` returns [0, 1), so a test can pass a fixed sequence. */
export function spinReels(
  reels: SpinReels,
  random: () => number = Math.random,
): SpinCombination {
  const pick = <T>(list: readonly T[], fallback: T): T =>
    list.length
      ? list[Math.floor(random() * list.length) % list.length]
      : fallback;

  return {
    pillar: pick(reels.pillars, ""),
    angle: pick(ANGLE_REEL, ANGLE_REEL[0]),
    // The creator's own formats win when they have them: a brain that says
    // "I only do talking head with captions" should not be dealt a demo.
    format: reels.formats.length
      ? pick(reels.formats, FORMAT_REEL[0])
      : pick(FORMAT_REEL, FORMAT_REEL[0]),
  };
}

/** Titles a spin should not land on again, kept short: it is a nudge in the
 * prompt, not a filter. */
export function recentTitles(titles: string[], limit = 12): string[] {
  return titles
    .map((title) => title.trim())
    .filter(Boolean)
    .slice(0, limit);
}
