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
 * Detect retakes: when a phrase of >= n words is repeated later, the earlier
 * attempt (and the stumble up to the restart) is cut, keeping the last take.
 * Conservative: only exact normalized n-grams within a `maxGapSec` window.
 */
export function findEarlierTakeRanges(
  words: Word[],
  n = 4,
  maxGapSec = 20,
): [number, number][] {
  const toks = words
    .map((w, i) => ({ t: norm(w.text), w, i }))
    .filter((x) => x.t.length > 0);
  if (toks.length < n * 2) return [];

  const seen = new Map<string, number>(); // ngram -> earliest token index
  const ranges: [number, number][] = [];

  let i = 0;
  while (i + n <= toks.length) {
    const key = toks
      .slice(i, i + n)
      .map((x) => x.t)
      .join(" ");
    const earlier = seen.get(key);
    if (earlier !== undefined && i > earlier + n - 1) {
      // A retake: cut from the earliest attempt up to this restart, then skip
      // the matched window so its shifted duplicates don't extend the cut.
      const from = toks[earlier].w.start;
      const to = toks[i].w.start;
      if (to - from <= maxGapSec) ranges.push([from, to]);
      i += n;
      continue;
    }
    if (earlier === undefined) seen.set(key, i);
    i++;
  }

  return mergeRanges(ranges);
}
