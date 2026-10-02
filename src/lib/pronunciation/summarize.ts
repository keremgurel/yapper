import {
  MAX_UNCLEAR_WORDS,
  UNCLEAR_BELOW,
  type PronunciationReport,
  type UnclearWord,
} from "./types";

/** Azure reports time in 100-nanosecond ticks. */
const TICKS = 10_000_000;

interface AzureScore {
  AccuracyScore?: number;
  FluencyScore?: number;
  ProsodyScore?: number;
  ErrorType?: string;
  Feedback?: { Prosody?: { Intonation?: { ErrorTypes?: string[] } } };
}
interface AzureWord {
  Word?: string;
  Offset?: number;
  PronunciationAssessment?: AzureScore;
  Phonemes?: { Phoneme?: string; PronunciationAssessment?: AzureScore }[];
}
/** One recognised phrase, as the Speech service returns it. */
export interface AzureSegment {
  Duration?: number;
  NBest?: { PronunciationAssessment?: AzureScore; Words?: AzureWord[] }[];
}

const round = (value: number) => Math.round(value);

function weakestSound(word: AzureWord): string | null {
  let weakest: { sound: string; score: number } | null = null;
  for (const phoneme of word.Phonemes ?? []) {
    const score = phoneme.PronunciationAssessment?.AccuracyScore;
    if (!phoneme.Phoneme || typeof score !== "number") continue;
    if (!weakest || score < weakest.score)
      weakest = { sound: phoneme.Phoneme, score };
  }
  return weakest && weakest.score < UNCLEAR_BELOW ? weakest.sound : null;
}

/**
 * Fold the phrase-by-phrase results into one report. Scores are averaged by
 * how long each phrase lasted, so a two-word aside does not weigh the same as
 * a long sentence. Returns null when nothing was recognised.
 */
export function summarizePronunciation(
  segments: AzureSegment[],
): PronunciationReport | null {
  let seconds = 0;
  let prosodySeconds = 0;
  const sum = { accuracy: 0, fluency: 0, prosody: 0 };
  let wordCount = 0;
  let monotone = 0;
  const unclear = new Map<string, UnclearWord>();

  for (const segment of segments) {
    const best = segment.NBest?.[0];
    const score = best?.PronunciationAssessment;
    const duration = (segment.Duration ?? 0) / TICKS;
    if (!best || !score || duration <= 0) continue;
    seconds += duration;
    sum.accuracy += (score.AccuracyScore ?? 0) * duration;
    sum.fluency += (score.FluencyScore ?? 0) * duration;
    if (typeof score.ProsodyScore === "number") {
      sum.prosody += score.ProsodyScore * duration;
      prosodySeconds += duration;
    }
    for (const word of best.Words ?? []) {
      const assessed = word.PronunciationAssessment;
      const accuracy = assessed?.AccuracyScore;
      if (!word.Word || !assessed || typeof accuracy !== "number") continue;
      wordCount += 1;
      if (
        assessed.Feedback?.Prosody?.Intonation?.ErrorTypes?.includes("Monotone")
      )
        monotone += 1;
      if (accuracy >= UNCLEAR_BELOW) continue;
      // The same word said badly twice is one thing to practice. Keep the
      // worst take of it.
      const key = word.Word.toLowerCase();
      const known = unclear.get(key);
      if (known && known.accuracy <= accuracy) continue;
      unclear.set(key, {
        text: word.Word,
        accuracy: round(accuracy),
        start: Math.round(((word.Offset ?? 0) / TICKS) * 10) / 10,
        sound: weakestSound(word),
      });
    }
  }
  if (seconds <= 0 || wordCount === 0) return null;
  return {
    accuracy: round(sum.accuracy / seconds),
    fluency: round(sum.fluency / seconds),
    prosody: prosodySeconds > 0 ? round(sum.prosody / prosodySeconds) : null,
    monotoneShare: round((monotone / wordCount) * 100),
    assessedSeconds: round(seconds),
    words: [...unclear.values()]
      .sort((a, b) => a.accuracy - b.accuracy)
      .slice(0, MAX_UNCLEAR_WORDS),
  };
}
