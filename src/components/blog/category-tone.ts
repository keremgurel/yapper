/**
 * Each category gets one of the three pastel fields used across the site, so
 * a guide looks the same on the homepage shelf, the blog index and its own
 * page. Stable by category name, not by position in a list.
 */
const TONES = ["lavender", "sage", "peach"] as const;
export type Tone = (typeof TONES)[number];

export function categoryTone(category: string): Tone {
  let hash = 0;
  for (const char of category) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return TONES[hash % TONES.length];
}
