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
    const start = snapTo(w.start, onsets, window);
    const end = snapTo(w.end, offsets, window);
    return end > start ? { ...w, start, end } : w;
  });
}

const FILLERS = new Set([
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
  "like",
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
  return words.filter((w) => FILLERS.has(norm(w.text))).map((w) => w.id);
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
 * Detect retakes: when a phrase is restarted (an opening of >= n words repeats
 * later), cut from the FIRST attempt up to the START of the LAST attempt — so
 * every earlier try is removed and only the final take is kept. Ranges from all
 * repeated n-grams are merged, which naturally spans the whole restarted region.
 * Conservative: only exact normalized n-grams whose span is within `maxGapSec`.
 */
export function findEarlierTakeRanges(
  words: Word[],
  n = 3,
  maxGapSec = 30,
): [number, number][] {
  const toks = words
    .map((w) => ({ t: norm(w.text), w }))
    .filter((x) => x.t.length > 0);
  if (toks.length < n * 2) return [];

  // Every start index where each n-gram occurs.
  const positions = new Map<string, number[]>();
  for (let i = 0; i + n <= toks.length; i++) {
    const key = toks
      .slice(i, i + n)
      .map((x) => x.t)
      .join(" ");
    const arr = positions.get(key);
    if (arr) arr.push(i);
    else positions.set(key, [i]);
  }

  const ranges: [number, number][] = [];
  for (const occ of positions.values()) {
    if (occ.length < 2) continue;
    const from = toks[occ[0]].w.start;
    const to = toks[occ[occ.length - 1]].w.start; // start of the last attempt
    if (to > from && to - from <= maxGapSec) ranges.push([from, to]);
  }

  return mergeRanges(ranges);
}
