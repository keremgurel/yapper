import { clipIndexAtSource } from "@/lib/studio/clips";
import type { SpeechSegment } from "@/lib/studio/silence";
import type { Clip, Word } from "@/lib/studio/types";

function snapTo(t: number, points: number[], window: number): number {
  let best = t;
  let bestD = window;
  for (const p of points) {
    const d = Math.abs(p - t);
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  return best;
}

/**
 * Correct Whisper's approximate word timings using the precise VAD boundaries:
 * a word that begins right after a pause snaps its start to the exact speech
 * onset, and a word before a pause snaps its end to the exact offset. Words in
 * the middle of continuous speech (far from any boundary) are left untouched,
 * so cuts made from the transcript land cleanly on real speech edges.
 *
 * Snapping is one-directional at the edges: a start only ever moves EARLIER and
 * an end only ever moves LATER. The transcriber's word starts already lag the
 * true onset, so a nearest-point snap that pulled a start later would make
 * captions appear late; likewise pulling an end earlier would clip the tail of
 * a word (and let the trailing-silence cut eat real speech). This keeps refined
 * timings a safe superset of each word's spoken span.
 */
export function refineWordTimings(
  words: Word[],
  segments: SpeechSegment[],
  window = 0.2,
): Word[] {
  if (segments.length === 0) return words;
  const onsets = segments.map((s) => s.start);
  const offsets = segments.map((s) => s.end);
  return words.map((w) => {
    const start = Math.min(w.start, snapTo(w.start, onsets, window));
    const end = Math.max(w.end, snapTo(w.end, offsets, window));
    return end > start ? { ...w, start, end } : w;
  });
}

const HESITATION_FILLERS = new Set([
  "um",
  "umm",
  "uh",
  "uhh",
  "uhm",
  "er",
  "err",
  "ah",
  "ahh",
  "hmm",
  "mhm",
]);

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9']/g, "");
}

/**
 * Build source ranges to cut from a selection. Walks the full transcript in
 * order so each maximal run of selected words becomes one continuous range
 * (from the run's first word start to its last word end, gaps included).
 */
export function selectionToRanges(
  allWords: Word[],
  selectedIds: Set<string>,
): [number, number][] {
  const ranges: [number, number][] = [];
  let run: [number, number] | null = null;
  for (const w of allWords) {
    if (selectedIds.has(w.id)) {
      if (run) run[1] = w.end;
      else run = [w.start, w.end];
    } else if (run) {
      ranges.push(run);
      run = null;
    }
  }
  if (run) ranges.push(run);
  return ranges;
}

/** A word is "cut" when its midpoint no longer falls inside any kept clip. */
export function isWordCut(clips: Clip[], word: Word): boolean {
  const mid = (word.start + word.end) / 2;
  return clipIndexAtSource(clips, mid) === -1;
}

/** True when a source range's midpoint is already removed from the timeline. */
export function isRangeCut(clips: Clip[], from: number, to: number): boolean {
  return clipIndexAtSource(clips, (from + to) / 2) === -1;
}

/**
 * Silent gaps between consecutive spoken words that are at least `minGap`
 * seconds long — the pauses. Because these ranges sit strictly between words,
 * cutting them can never remove speech.
 */
export function pauseRanges(words: Word[], minGap = 0.4): [number, number][] {
  const ranges: [number, number][] = [];
  for (let i = 0; i < words.length - 1; i++) {
    const gap = words[i + 1].start - words[i].end;
    if (gap >= minGap) ranges.push([words[i].end, words[i + 1].start]);
  }
  return ranges;
}

export function findFillerIds(words: Word[]): string[] {
  return words
    .filter((word) => {
      const token = norm(word.text);
      if (HESITATION_FILLERS.has(token)) return true;
      if (token !== "like") return false;

      // "Like" is often grammatical content ("feel like the real exam",
      // "looks like rain", "would like to"). Treat it as filler only when the
      // transcript itself marks it as a parenthetical discourse word. Being
      // conservative here is intentional: leaving one conversational "like"
      // is repairable; deleting a comparison changes the speaker's meaning.
      return /[,;:]$/.test(word.text.trim());
    })
    .map((word) => word.id);
}

function mergeRanges(ranges: [number, number][]): [number, number][] {
  if (ranges.length === 0) return [];
  const sorted = [...ranges].sort((a, b) => a[0] - b[0]);
  const out: [number, number][] = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    const last = out[out.length - 1];
    const cur = sorted[i];
    if (cur[0] <= last[1] + 0.06) last[1] = Math.max(last[1], cur[1]);
    else out.push(cur);
  }
  return out;
}

/**
 * Detect retakes and keep ONLY the last attempt. Walk the transcript forward;
 * when the phrase opening at position i (an n-gram) recurs later within
 * `maxGapSec`, the span [i, recurrence) is an earlier attempt — cut it and
 * continue scanning FROM the recurrence, so a 3rd attempt cuts the 2nd, etc.
 *
 * Because each cut ends exactly at the next attempt's start (and scanning
 * resumes there), the cut can never extend into the final take — which is the
 * failure of a merge-every-repeated-n-gram approach, where an n-gram deep inside
 * the phrase (e.g. "here's how") recurs across attempts and drags the cut into
 * the last, correct attempt. Uses n=4 to avoid cutting incidental short repeats.
 */
export function findEarlierTakeRanges(
  words: Word[],
  n = 4,
  maxGapSec = 25,
): [number, number][] {
  const toks = words
    .map((w) => ({ t: norm(w.text), w }))
    .filter((x) => x.t.length > 0);
  if (toks.length < n * 2) return [];

  const keyAt = (i: number) =>
    toks
      .slice(i, i + n)
      .map((x) => x.t)
      .join(" ");

  const ranges: [number, number][] = [];
  let i = 0;
  while (i + n <= toks.length) {
    const key = keyAt(i);
    let recurrence = -1;
    for (let j = i + 1; j + n <= toks.length; j++) {
      if (toks[j].w.start - toks[i].w.start > maxGapSec) break;
      if (keyAt(j) === key) {
        recurrence = j;
        break;
      }
    }
    if (recurrence >= 0) {
      ranges.push([toks[i].w.start, toks[recurrence].w.start]);
      i = recurrence; // resume from the restart → keeps the last attempt intact
    } else {
      i++;
    }
  }

  return mergeRanges(ranges);
}

/**
 * Retake/mistake ranges to remove. The AI pass is the primary source. Its word
 * ranges have already been mapped to validated contiguous source takes by the
 * backend, so whenever it proposes cuts we trust them directly.
 *
 * This used to re-validate every AI cut against nearby text (multiset/LCS
 * coverage, an "is this restated later" check) and reject any span that
 * wasn't itself a near-duplicate elsewhere. That check cannot tell a
 * disposable aside ("okay", "hold on", a dropped tangent — legitimate cuts
 * that are NOT retakes) apart from precious unique content, since both look
 * identical to a text-similarity check: neither has a duplicate nearby. In
 * practice it silently put filler back into the "kept" transcript any time
 * the AI correctly cut something that wasn't a repeat, which is exactly the
 * under-cutting this pipeline exists to fix. The backend's contiguous-take
 * selection is what proves a span isn't needed; a second independent guess
 * bolted on top doesn't add real protection, only false rejections.
 *
 * The deterministic exact-repeat detector is intentionally NOT unioned in
 * here — it over-cuts on near-repeats and would delete words the AI
 * correctly kept. It serves purely as the fallback when no AI key is
 * configured (aiCuts === null) or the AI finds nothing to cut, cases where
 * its worst failure is a leftover fragment rather than lost speech.
 *
 * Returns merged source-time ranges.
 */
export function combineRetakeCuts(
  words: Word[],
  aiCuts: [number, number][] | null,
): [number, number][] {
  if (!aiCuts || aiCuts.length === 0) return findEarlierTakeRanges(words);
  const ranges = aiCuts
    .filter(([i, j]) => words[i] && words[j] && words[j].end > words[i].start)
    .map(([i, j]) => [words[i].start, words[j].end] as [number, number]);
  return mergeRanges(ranges);
}
