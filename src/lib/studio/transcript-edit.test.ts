import { describe, expect, it } from "vitest";
import {
  combineRetakeCuts,
  findEarlierTakeRanges,
  isRetakeCut,
  pauseRanges,
  refineWordTimings,
  selectionToRanges,
} from "@/lib/studio/transcript-edit";
import type { Word } from "@/lib/studio/types";

/** One word per second, so a range's seconds read straight off its indices. */
const transcribe = (text: string): Word[] =>
  text
    .split(" ")
    .map((t, i) => ({ id: `w-${i}`, text: t, start: i, end: i + 1 }));

describe("selectionToRanges", () => {
  const words = transcribe("a b c d e f");
  const ids = (...idx: number[]) => new Set(idx.map((i) => `w-${i}`));

  it("merges a contiguous selection into one range", () => {
    expect(selectionToRanges(words, ids(0, 1, 2))).toEqual([[0, 3]]);
  });

  it("splits a selection broken by an unselected word into separate runs", () => {
    // a and c selected, b skipped: two runs, not one range spanning the gap.
    expect(selectionToRanges(words, ids(0, 2))).toEqual([
      [0, 1],
      [2, 3],
    ]);
  });

  it("keeps an interior gap inside a single run", () => {
    // b, c, e selected: b-c is one run, e is another.
    expect(selectionToRanges(words, ids(1, 2, 4))).toEqual([
      [1, 3],
      [4, 5],
    ]);
  });
});

describe("pauseRanges", () => {
  // Words at [0,1], [1,2], then a 1s gap, then [3,4].
  const words: Word[] = [
    { id: "w-0", text: "one", start: 0, end: 1 },
    { id: "w-1", text: "two", start: 1, end: 2 },
    { id: "w-2", text: "three", start: 3, end: 4 },
  ];

  it("returns the silent gap between words when it clears the threshold", () => {
    expect(pauseRanges(words, 0.4)).toEqual([[2, 3]]);
  });

  it("ignores a gap shorter than the threshold", () => {
    expect(pauseRanges(words, 1.5)).toEqual([]);
  });
});

describe("refineWordTimings", () => {
  const segments = [{ start: 1, end: 2 }];

  it("snaps a lagging start earlier to the exact onset and a short end later", () => {
    const [w] = refineWordTimings(
      [{ id: "w", text: "hi", start: 1.05, end: 1.9 }],
      segments,
    );
    expect(w.start).toBeCloseTo(1, 5);
    expect(w.end).toBeCloseTo(2, 5);
  });

  it("never pulls a start later than the transcriber gave it", () => {
    // Onset (1) is later than the word start (0.9) and within the window, but a
    // start may only ever move earlier, so it must stay at 0.9.
    const [w] = refineWordTimings(
      [{ id: "w", text: "hi", start: 0.9, end: 1.5 }],
      segments,
    );
    expect(w.start).toBeCloseTo(0.9, 5);
  });
});

describe("findEarlierTakeRanges", () => {
  it("cuts an earlier attempt and keeps the final take intact", () => {
    // Two attempts of the same 4-gram, then unique tail. The first attempt
    // (0..4) is cut; the take at 4..10 survives untouched.
    const words = transcribe("here is my intro here is my intro for real");
    expect(findEarlierTakeRanges(words)).toEqual([[0, 4]]);
  });

  it("does not let interior repeats drag the cut into the final take", () => {
    // The whole 7-word phrase is said twice. A scan that did not resume from the
    // recurrence would keep matching interior 4-grams across the two takes and
    // extend the cut past token 7, eating the start of the final, correct take.
    // Resuming from the recurrence stops the cut exactly at 7.
    const words = transcribe(
      "the best way to grow is consistency the best way to grow is consistency",
    );
    expect(findEarlierTakeRanges(words)).toEqual([[0, 7]]);
  });
});

describe("isRetakeCut", () => {
  it("trusts a very short cut without checking context", () => {
    const words = transcribe("alpha bravo charlie delta echo foxtrot");
    expect(isRetakeCut(words, 0, 1)).toBe(true);
  });

  it("trusts a cut whose words are restated nearby", () => {
    // The cut phrase recurs immediately after it: a genuine restart.
    const words = transcribe(
      "alpha bravo charlie delta alpha bravo charlie delta",
    );
    expect(isRetakeCut(words, 0, 3)).toBe(true);
  });

  it("refuses to cut unique content that is not restated nearby", () => {
    const words = transcribe(
      "alpha bravo charlie delta echo foxtrot golf hotel",
    );
    expect(isRetakeCut(words, 0, 3)).toBe(false);
  });
});

describe("combineRetakeCuts", () => {
  const words = transcribe(
    "alpha bravo charlie delta alpha bravo charlie delta",
  );

  it("trusts only the validated AI cuts when the AI returns some", () => {
    expect(combineRetakeCuts(words, [[0, 3]])).toEqual([[0, 4]]);
  });

  it("drops an AI cut that removes unique, un-restated content", () => {
    const unique = transcribe(
      "alpha bravo charlie delta echo foxtrot golf hotel",
    );
    expect(combineRetakeCuts(unique, [[0, 3]])).toEqual([]);
  });

  it("falls back to the deterministic detector when the AI is unavailable", () => {
    expect(combineRetakeCuts(words, null)).toEqual([[0, 4]]);
  });

  it("falls back to the deterministic detector when the AI finds nothing", () => {
    expect(combineRetakeCuts(words, [])).toEqual([[0, 4]]);
  });
});
