import { describe, expect, it } from "vitest";
import { cutsFromCleanedText } from "@/lib/studio/align-transcript";
import {
  combineRetakeCuts,
  findEarlierTakeRanges,
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

/** One-second words with a one-second pause between utterances. */
const transcribeUtterances = (...lines: string[]): Word[] => {
  let cursor = 0;
  let id = 0;
  return lines.flatMap((line) => {
    const words = line.split(" ").map((text) => ({
      id: `u-${id++}`,
      text,
      start: cursor,
      end: ++cursor,
    }));
    cursor++;
    return words;
  });
};

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

describe("combineRetakeCuts", () => {
  const words = transcribeUtterances(
    "alpha bravo charlie delta.",
    "alpha bravo charlie delta.",
  );

  it("trusts the AI cuts directly when the AI returns some", () => {
    expect(combineRetakeCuts(words, [[0, 3]])).toEqual([[0, 4]]);
  });

  // cutsFromCleanedText derives a cut as exactly the source span that's
  // absent from the AI's cleaned script — that's already proof the span
  // isn't needed, whether it's a retake (has a duplicate nearby) or a
  // disposable aside (doesn't). A prior version of this function additionally
  // required every AI cut to have a near-duplicate elsewhere in the
  // transcript before trusting it, which silently put non-repeat filler back
  // into the kept output — a text-similarity check can't tell "unique but
  // disposable" apart from "unique and important," so it rejected both.
  it("trusts an AI cut even when the removed content has no duplicate nearby", () => {
    const unique = transcribe(
      "alpha bravo charlie delta echo foxtrot golf hotel",
    );
    expect(combineRetakeCuts(unique, [[0, 3]])).toEqual([[0, 4]]);
  });

  it("falls back to the deterministic detector when the AI is unavailable", () => {
    expect(combineRetakeCuts(words, null)).toEqual([[0, 5]]);
  });

  it("falls back to the deterministic detector when the AI finds nothing", () => {
    const exact = transcribe(
      "alpha bravo charlie delta alpha bravo charlie delta",
    );
    expect(combineRetakeCuts(exact, [])).toEqual([[0, 4]]);
  });

  // Regression for "1-Click edit keeps almost all the retakes": a real DJI
  // recording had the speaker restart the same ~15-word sentence 4-6 times in
  // a row with NO pause and NO punctuation between attempts (only the final
  // attempt ends in a period). cutsFromCleanedText's matching-blocks
  // alignment (see align-transcript.test.ts) resolves this correctly on its
  // own, and combineRetakeCuts now trusts that result directly instead of
  // re-validating it — end to end, the whole un-paused cluster is cut and
  // only the clean final attempt survives.
  it("cuts a whole rapid-restart retake cluster with no pauses or punctuation between attempts", () => {
    const attempt =
      "you can take full practice tests drill individual questions or go through the course modules";
    const attempts = [attempt, attempt, attempt, attempt, `${attempt}.`];
    const sourceText = attempts.join(" ");
    const cleanedText = `${attempt}.`;

    const words = transcribe(sourceText);
    const aiCuts = cutsFromCleanedText(words, cleanedText);
    const cuts = combineRetakeCuts(words, aiCuts);

    const kept = words
      .filter((w) => {
        const mid = (w.start + w.end) / 2;
        return !cuts.some(([from, to]) => mid >= from && mid <= to);
      })
      .map((w) => w.text)
      .join(" ");
    expect(kept).toBe(cleanedText);
  });

  // Regression for a second real-world under-cut: the AI's cleaned script
  // correctly dropped a disposable aside ("Practice exams are a good
  // representation. Okay.") sitting between two takes — it isn't a retake of
  // anything, just a tangent the AI decided to cut, exactly the kind of edit
  // the old "must be restated nearby" validation rejected because it has no
  // duplicate anywhere in the transcript.
  it("cuts a non-repeat aside the AI's cleaned text correctly dropped", () => {
    const pre =
      "here's the truth building the app itself was not the hard part.";
    const goodTake =
      "the resource intensive part was making sure the questions actually feel like the real exam and that the scoring and feedback are accurate as possible.";
    const aside = "practice exams are a good representation. okay.";
    const post =
      "i collected more than 30 official satip speaking samples with real scores.";

    const sourceText = [pre, aside, goodTake, post].join(" ");
    const cleanedText = [pre, goodTake, post].join(" ");

    const words = transcribe(sourceText);
    const aiCuts = cutsFromCleanedText(words, cleanedText);
    const cuts = combineRetakeCuts(words, aiCuts);

    const kept = words
      .filter((w) => {
        const mid = (w.start + w.end) / 2;
        return !cuts.some(([from, to]) => mid >= from && mid <= to);
      })
      .map((w) => w.text)
      .join(" ");
    expect(kept).toBe(cleanedText);
  });
});
