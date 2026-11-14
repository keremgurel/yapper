/**
 * How much of an inspiration card rides on a turn. The Inspiration tab cuts
 * the card to these before sending, because a long video's transcript alone
 * can pass the turn's 64 KB body limit, and the server cuts again because
 * the body is client supplied. Kept apart from focus.ts so the browser
 * bundle does not pull in the action schema that file's imports reach.
 */
export const INSPIRATION_FOCUS_MAX = {
  url: 600,
  title: 300,
  platform: 20,
  author: 120,
  note: 1000,
  transcript: 12_000,
} as const;

export const isWebLink = (url: string) => /^https?:\/\//i.test(url);
