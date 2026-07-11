/**
 * The ASR heard meaningfully less audio than the client built, which means the
 * request body was truncated in transit (the proxy/middleware body-size cap)
 * and the transcript is missing its tail. Returned to the route so it can fail
 * loudly instead of handing back a transcript that silently drops the ending.
 *
 * A small tolerance absorbs codec padding and rounding; real truncation removes
 * many seconds, so it clears the threshold easily. When either duration is
 * unknown (0), we never flag it — a missing signal must not block a good
 * transcript.
 */
export function isAudioTruncated(
  expectedSec: number,
  heardSec: number,
  tolSec = 1,
): boolean {
  if (expectedSec <= 0 || heardSec <= 0) return false;
  return heardSec < expectedSec - tolSec;
}
