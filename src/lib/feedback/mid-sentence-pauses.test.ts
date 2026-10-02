import { describe, expect, it } from "vitest";
import { computeMetrics, type FeedbackWord } from "./metrics";

/** Words back to back, with a gap in seconds before each named index. */
function words(texts: string[], gaps: Record<number, number>): FeedbackWord[] {
  let at = 0;
  return texts.map((text, index) => {
    at += gaps[index] ?? 0.05;
    const word = { text, start: at, end: at + 0.3 };
    at += 0.3;
    return word;
  });
}

describe("where pauses fall", () => {
  it("counts a pause after an unfinished thought as mid-sentence", () => {
    const metrics = computeMetrics(
      words(["I", "think", "the", "answer", "is", "simple."], { 3: 0.8 }),
    );
    expect(metrics.pauseCount).toBe(1);
    expect(metrics.midSentencePauseCount).toBe(1);
  });
  it("does not count a pause after a full stop or a comma", () => {
    const metrics = computeMetrics(
      words(["Done.", "Next,", "we", "move", "on."], { 1: 0.9, 2: 0.7 }),
    );
    expect(metrics.pauseCount).toBe(2);
    expect(metrics.midSentencePauseCount).toBe(0);
  });
});
