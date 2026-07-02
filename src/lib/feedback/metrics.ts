/**
 * Deterministic delivery metrics computed from the transcript + word timings.
 * This is the FREE part of feedback — no LLM. The coaching pass is handed these
 * numbers so it explains rather than recomputes.
 */

export interface FeedbackWord {
  text: string;
  start: number;
  end: number;
  confidence?: number;
}

export interface DeliveryMetrics {
  durationSec: number;
  wordCount: number;
  /** Words per minute over the whole clip (includes pauses). */
  wpm: number;
  /** Words per minute of actual voiced time (pauses removed). */
  articulationRate: number;
  fillerCount: number;
  fillerPerMin: number;
  fillerBreakdown: { word: string; count: number }[];
  pauseCount: number;
  longPauseCount: number;
  totalPauseSec: number;
  longestPauseSec: number;
  /** Undefined when the provider doesn't return per-word confidence. */
  avgConfidence?: number;
  lowConfidenceWords?: string[];
  uniqueWords: number;
  typeTokenRatio: number;
  topRepeated: { word: string; count: number }[];
}

// Unambiguous verbal fillers. Context-dependent ones (so, right, well, actually)
// are left to the LLM to judge, to avoid over-counting real usage.
const FILLERS = new Set([
  "um",
  "uh",
  "er",
  "erm",
  "ah",
  "hmm",
  "mm",
  "mhm",
  "like",
  "basically",
  "literally",
]);
const BIGRAM_FILLERS = [
  ["you", "know"],
  ["i", "mean"],
  ["sort", "of"],
  ["kind", "of"],
];

const PAUSE = 0.5; // seconds — a noticeable pause
const LONG_PAUSE = 1.5; // seconds — dead air
const LOW_CONFIDENCE = 0.6;

const norm = (t: string): string => t.toLowerCase().replace(/[^\p{L}']/gu, "");

const round = (n: number, d = 1): number => {
  const f = 10 ** d;
  return Math.round(n * f) / f;
};

export function computeMetrics(words: FeedbackWord[]): DeliveryMetrics {
  const tokens = words.map((w) => norm(w.text));
  const wordCount = tokens.filter(Boolean).length;
  const first = words[0];
  const last = words[words.length - 1];
  const durationSec = first && last ? Math.max(0, last.end - first.start) : 0;
  const minutes = durationSec / 60 || 1 / 60;

  // Pauses (gaps between consecutive words).
  let pauseCount = 0;
  let longPauseCount = 0;
  let totalPauseSec = 0;
  let longestPauseSec = 0;
  for (let i = 1; i < words.length; i++) {
    const gap = words[i].start - words[i - 1].end;
    if (gap >= PAUSE) {
      pauseCount++;
      totalPauseSec += gap;
      if (gap >= LONG_PAUSE) longPauseCount++;
      if (gap > longestPauseSec) longestPauseSec = gap;
    }
  }
  const voicedSec = Math.max(0.1, durationSec - totalPauseSec);

  // Fillers (single + bigram).
  const fillerCounts = new Map<string, number>();
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (!t) continue;
    if (FILLERS.has(t)) {
      fillerCounts.set(t, (fillerCounts.get(t) ?? 0) + 1);
      continue;
    }
    const next = tokens[i + 1];
    const bigram = BIGRAM_FILLERS.find(([a, b]) => a === t && b === next);
    if (bigram) {
      const key = bigram.join(" ");
      fillerCounts.set(key, (fillerCounts.get(key) ?? 0) + 1);
      i++; // consume the second word
    }
  }
  const fillerBreakdown = [...fillerCounts.entries()]
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count);
  const fillerCount = fillerBreakdown.reduce((s, f) => s + f.count, 0);

  // Confidence / clarity (only if the provider returned it).
  const withConf = words.filter((w) => typeof w.confidence === "number");
  let avgConfidence: number | undefined;
  let lowConfidenceWords: string[] | undefined;
  if (withConf.length) {
    avgConfidence =
      withConf.reduce((s, w) => s + (w.confidence as number), 0) /
      withConf.length;
    lowConfidenceWords = withConf
      .filter((w) => (w.confidence as number) < LOW_CONFIDENCE)
      .map((w) => w.text)
      .slice(0, 12);
  }

  // Vocabulary.
  const content = tokens.filter((t) => t && !FILLERS.has(t));
  const freq = new Map<string, number>();
  for (const t of content) freq.set(t, (freq.get(t) ?? 0) + 1);
  const uniqueWords = new Set(content).size;
  const topRepeated = [...freq.entries()]
    .filter(([w, c]) => c > 2 && w.length > 3)
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    durationSec: round(durationSec),
    wordCount,
    wpm: round(wordCount / minutes),
    articulationRate: round(wordCount / (voicedSec / 60)),
    fillerCount,
    fillerPerMin: round(fillerCount / minutes),
    fillerBreakdown,
    pauseCount,
    longPauseCount,
    totalPauseSec: round(totalPauseSec),
    longestPauseSec: round(longestPauseSec),
    avgConfidence:
      avgConfidence !== undefined ? round(avgConfidence, 2) : undefined,
    lowConfidenceWords,
    uniqueWords,
    typeTokenRatio: content.length ? round(uniqueWords / content.length, 2) : 0,
    topRepeated,
  };
}
