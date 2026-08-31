import { describe, expect, it } from "vitest";
import { mergeAsrChunks } from "./chunks";

describe("mergeAsrChunks", () => {
  it("deduplicates an overlapping phrase", () => {
    const merged = mergeAsrChunks([
      {
        offset: 0,
        duration: 10,
        heardSec: 10,
        words: [
          { text: "the", start: 7.4, end: 7.7 },
          { text: "work", start: 7.7, end: 8.1 },
        ],
      },
      {
        offset: 6,
        duration: 10,
        heardSec: 10,
        words: [
          { text: "the", start: 1.42, end: 1.72 },
          { text: "work", start: 1.72, end: 2.12 },
          { text: "stacks", start: 2.12, end: 2.5 },
        ],
      },
    ]);

    expect(merged.words.map((word) => word.text)).toEqual([
      "the",
      "work",
      "stacks",
    ]);
  });

  it("restores a seam word heard by only one pass", () => {
    const merged = mergeAsrChunks([
      {
        offset: 0,
        duration: 10,
        heardSec: 10,
        words: [{ text: "quiet", start: 7.8, end: 8.15 }],
      },
      { offset: 6, duration: 10, heardSec: 10, words: [] },
    ]);

    expect(merged.words).toEqual([{ text: "quiet", start: 7.8, end: 8.15 }]);
    expect(merged.heardSec).toBe(16);
  });
});
