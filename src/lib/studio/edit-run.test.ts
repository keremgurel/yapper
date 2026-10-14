import { describe, expect, it } from "vitest";
import { measureEditRun, timeSavedSeconds } from "./edit-run";

const words = [
  { text: "so", start: 1, end: 1.4 },
  { text: "um", start: 1.5, end: 2 },
  { text: "today", start: 2.2, end: 2.8 },
  { text: "today", start: 3.5, end: 4 },
  { text: "we", start: 4.1, end: 4.4 },
];

describe("measureEditRun", () => {
  it("measures footage and the seconds each cut removed", () => {
    const run = measureEditRun(words, [
      [1, 1],
      [2, 2],
    ]);
    expect(run.footageSeconds).toBeCloseTo(3.4);
    expect(run.cutCount).toBe(2);
    expect(run.cutSeconds).toBeCloseTo(1.1);
    expect(run.wordCount).toBe(5);
  });

  it("still counts cuts when the words carry no timings", () => {
    const run = measureEditRun(
      words.map(({ text }) => ({ text })),
      [[0, 1]],
    );
    expect(run).toEqual({
      footageSeconds: 0,
      cutCount: 1,
      cutSeconds: 0,
      wordCount: 5,
    });
  });
});

describe("timeSavedSeconds", () => {
  it("is one watch of the footage plus twenty seconds a cut", () => {
    // Cutai's own example: 21 hr 22 min of footage and 9,122 cuts read as
    // 72 hr 3 min saved.
    const saved = timeSavedSeconds({
      footageSeconds: (21 * 60 + 22) * 60,
      cutCount: 9_122,
    });
    expect(Math.round(saved / 60)).toBe(72 * 60 + 3);
  });
});
