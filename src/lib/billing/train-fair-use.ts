/**
 * Train Plus is sold as unlimited AI feedback. This ceiling is not shown on
 * the pricing page; it exists to stop automation, not to ration practice. One
 * session costs a few cents, and thirty a day is far past what a person
 * practicing by hand gets through.
 */
export const TRAIN_FAIR_USE_DAILY_SESSIONS = 30;

/** The UTC day a session counts toward. */
export function fairUseDayStart(now: Date = new Date()): Date {
  const start = new Date(now);
  start.setUTCHours(0, 0, 0, 0);
  return start;
}

/** When the daily allowance resets: the start of the next UTC day. */
export function fairUseResetsAt(now: Date = new Date()): Date {
  const next = fairUseDayStart(now);
  next.setUTCDate(next.getUTCDate() + 1);
  return next;
}

export function withinFairUse(sessionsToday: number): boolean {
  return sessionsToday < TRAIN_FAIR_USE_DAILY_SESSIONS;
}
