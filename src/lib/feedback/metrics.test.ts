import { describe, expect, it } from "vitest";
import { computeMetrics, type FeedbackWord } from "@/lib/feedback/metrics";

const w = (
  text: string,
  start: number,
  end: number,
  confidence?: number,
): FeedbackWord => ({
  text,
  start,
  end,
  ...(confidence != null ? { confidence } : {}),
});

describe("computeMetrics counts and rates", () => {
  it("computes word count, duration, wpm, and articulation rate", () => {
    const m = computeMetrics([
      w("Um,", 0, 0.3),
      w("I", 0.3, 0.5),
      w("mean", 0.5, 0.8),
      w("this", 1.5, 1.8),
      w("project", 1.8, 2.4),
      w("is", 2.4, 2.6),
      w("basically", 2.6, 3.2),
      w("great", 5.0, 5.5),
    ]);
    expect(m.wordCount).toBe(8);
    expect(m.durationSec).toBe(5.5);
    expect(m.wpm).toBe(87.3); // 8 / (5.5/60)
    // Voiced time is 5.5 - 2.5s of pauses = 3.0s, so 8 / (3/60) = 160.
    expect(m.articulationRate).toBe(160);
  });
});

describe("computeMetrics pauses", () => {
  it("counts pauses inclusively at the 0.5s and 1.5s thresholds", () => {
    const m = computeMetrics([
      w("a", 0, 1.0),
      w("b", 1.5, 2.0), // gap exactly 0.5 -> a pause, not a long one
      w("c", 2.0, 2.5), // gap 0 -> no pause
      w("d", 4.0, 4.5), // gap 1.5 -> long pause
    ]);
    expect(m.pauseCount).toBe(2);
    expect(m.longPauseCount).toBe(1);
    expect(m.totalPauseSec).toBe(2.0);
    expect(m.longestPauseSec).toBe(1.5);
  });
});

describe("computeMetrics fillers", () => {
  it("counts single-word and bigram fillers, breakdown by frequency", () => {
    const m = computeMetrics([
      w("um", 0, 0.3),
      w("you", 0.3, 0.5),
      w("know", 0.5, 0.8), // "you know" is one bigram filler
      w("like", 0.8, 1.0),
      w("cool", 1.0, 1.3),
    ]);
    expect(m.fillerCount).toBe(3);
    expect(m.fillerBreakdown).toEqual([
      { word: "um", count: 1 },
      { word: "you know", count: 1 },
      { word: "like", count: 1 },
    ]);
  });
});

describe("computeMetrics confidence", () => {
  it("averages confidence and flags the low-confidence words", () => {
    const m = computeMetrics([
      w("clear", 0, 1, 0.9),
      w("mumble", 1, 2, 0.4),
      w("okay", 2, 3, 0.55),
    ]);
    expect(m.avgConfidence).toBe(0.62); // (0.9 + 0.4 + 0.55) / 3
    expect(m.lowConfidenceWords).toEqual(["mumble", "okay"]);
  });

  it("leaves confidence fields undefined when the provider omits them", () => {
    const m = computeMetrics([w("a", 0, 1), w("b", 1, 2)]);
    expect(m.avgConfidence).toBeUndefined();
    expect(m.lowConfidenceWords).toBeUndefined();
  });
});

describe("computeMetrics vocabulary", () => {
  it("computes richness and only counts words repeated more than twice", () => {
    const m = computeMetrics([
      w("hello", 0, 0.5),
      w("hello", 0.5, 1), // count 2 -> NOT in topRepeated (needs > 2)
      w("world", 1, 1.5),
      w("world", 1.5, 2),
      w("world", 2, 2.5), // count 3 -> in topRepeated
      w("great", 2.5, 3),
    ]);
    expect(m.uniqueWords).toBe(3);
    expect(m.typeTokenRatio).toBe(0.5); // 3 unique / 6 content words
    expect(m.topRepeated).toEqual([{ word: "world", count: 3 }]);
  });
});
