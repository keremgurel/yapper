/** How many times a publish is checked before the sheet offers a manual
 * status check. With the waits below that is a little over two minutes. */
export const PUBLISH_POLL_ATTEMPTS = 32;

/**
 * The wait before the next status check, after `attempt` pending answers.
 * Most posts settle within the first half minute, so the early checks are
 * close together and the later ones back off. The pace stays under TikTok's
 * limit of 30 status reads a minute.
 */
export function publishPollDelayMs(attempt: number): number {
  if (attempt < 5) return 2_000;
  if (attempt < 15) return 3_000;
  return 5_000;
}
