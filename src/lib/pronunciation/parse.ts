import {
  MAX_ASSESSED_SECONDS,
  MAX_UNCLEAR_WORDS,
  type PronunciationReport,
  type UnclearWord,
} from "./types";

const score = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.min(100, Math.round(value)))
    : null;

function parseWord(value: unknown): UnclearWord | null {
  if (typeof value !== "object" || value === null) return null;
  const word = value as Record<string, unknown>;
  const accuracy = score(word.accuracy);
  if (typeof word.text !== "string" || accuracy === null) return null;
  const text = word.text.trim().slice(0, 40);
  if (!text) return null;
  return {
    text,
    accuracy,
    start:
      typeof word.start === "number" && Number.isFinite(word.start)
        ? Math.max(0, Math.round(word.start * 10) / 10)
        : 0,
    sound: typeof word.sound === "string" ? word.sound.slice(0, 8) : null,
  };
}

/**
 * Read a report the browser sent. It was computed on the user's own device, so
 * every field is checked and clamped before it is stored. Returns null when it
 * is not a usable report.
 */
export function parsePronunciation(value: unknown): PronunciationReport | null {
  if (typeof value !== "object" || value === null) return null;
  const report = value as Record<string, unknown>;
  const accuracy = score(report.accuracy);
  const fluency = score(report.fluency);
  const seconds = report.assessedSeconds;
  if (accuracy === null || fluency === null) return null;
  if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds <= 0)
    return null;
  return {
    accuracy,
    fluency,
    prosody: score(report.prosody),
    monotoneShare: score(report.monotoneShare) ?? 0,
    // A little slack: phrase durations can sum slightly past the audio cap.
    assessedSeconds: Math.min(Math.round(seconds), MAX_ASSESSED_SECONDS + 10),
    words: (Array.isArray(report.words) ? report.words : [])
      .slice(0, MAX_UNCLEAR_WORDS)
      .flatMap((word) => parseWord(word) ?? []),
  };
}
