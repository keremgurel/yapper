/**
 * How long a script takes to say out loud.
 *
 * The number that matters when prepping a shoot is not the character count, it
 * is whether this fits the format. 145 wpm is the middle of the conversational
 * range the app already teaches in the words-per-minute tool; short-form
 * delivery runs a little quicker than a keynote but not by much.
 */
const WORDS_PER_MINUTE = 145;

export interface ScriptMeter {
  words: number;
  seconds: number;
  /** "48s" or "1:12", whichever reads faster at a glance. */
  label: string;
}

export function scriptMeter(script: string | null | undefined): ScriptMeter {
  const words = (script ?? "").trim().split(/\s+/).filter(Boolean).length;
  const seconds = Math.round((words / WORDS_PER_MINUTE) * 60);
  return { words, seconds, label: durationLabel(seconds) };
}

function durationLabel(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}
