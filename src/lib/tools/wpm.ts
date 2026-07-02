/** Speaking-pace presets (words per minute). Conversational video delivery sits
 * around 130-150; slower reads clearer, faster feels energetic but rushes. */
export const WPM_PACES = [
  { wpm: 110, label: "Slow", hint: "Deliberate, clear" },
  { wpm: 130, label: "Conversational", hint: "Natural on camera" },
  { wpm: 160, label: "Fast", hint: "High energy" },
  { wpm: 190, label: "Rapid", hint: "Auctioneer territory" },
] as const;

/** Count spoken words in a block of text (whitespace-delimited, punctuation-safe). */
export function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

/** Seconds it takes to speak `words` at `wpm`. */
export function speakingSeconds(words: number, wpm: number): number {
  if (wpm <= 0) return 0;
  return (words / wpm) * 60;
}

/** How many words fit into `seconds` at `wpm` (for planning to a target length). */
export function wordsForSeconds(seconds: number, wpm: number): number {
  return Math.round((seconds / 60) * wpm);
}

/** Format seconds as m:ss (e.g. 95 → "1:35"), or "0:00" for nothing. */
export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
