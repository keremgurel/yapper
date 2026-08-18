import { describe, expect, it } from "vitest";
import type { FeedbackWord } from "@/lib/feedback/metrics";
import {
  resolveCorrections,
  type ModelCorrection,
} from "@/lib/training-feedback/corrections";

const words: FeedbackWord[] = [
  "So",
  "um",
  "I",
  "go",
  "to",
  "the",
  "store",
  "yesterday",
].map((text, i) => ({ text, start: i, end: i + 0.8 }));

const correction = (
  overrides: Partial<ModelCorrection> = {},
): ModelCorrection => ({
  type: "grammar",
  wordIndex: 3,
  wordCount: 1,
  fix: "went",
  note: "past events take the past tense",
  ...overrides,
});

describe("resolveCorrections", () => {
  it("resolves a span to its verbatim text and timestamps", () => {
    const [out] = resolveCorrections([correction()], words);
    expect(out).toEqual({
      type: "grammar",
      original: "go",
      fix: "went",
      note: "past events take the past tense",
      start: 3,
      end: 3.8,
    });
  });

  it("joins multi-word spans and uses the outer timestamps", () => {
    const [out] = resolveCorrections(
      [correction({ wordIndex: 4, wordCount: 3, fix: null, note: null })],
      words,
    );
    expect(out.original).toBe("to the store");
    expect(out.start).toBe(4);
    expect(out.end).toBe(6.8);
  });

  it("silently drops spans outside the transcript", () => {
    const out = resolveCorrections(
      [
        correction({ wordIndex: -1 }),
        correction({ wordIndex: 8 }),
        correction({ wordIndex: 6, wordCount: 3 }),
        correction({ wordIndex: 2, wordCount: 0 }),
        correction({ wordIndex: 1.5 }),
        correction({ wordCount: 1.5 }),
      ],
      words,
    );
    expect(out).toEqual([]);
  });

  it("sorts by span start", () => {
    const out = resolveCorrections(
      [
        correction({ wordIndex: 7, wordCount: 1 }),
        correction({ wordIndex: 1, wordCount: 1, type: "filler", fix: null }),
      ],
      words,
    );
    expect(out.map((c) => c.original)).toEqual(["um", "yesterday"]);
  });

  it("rejects overlapping spans, keeping the earlier one", () => {
    const out = resolveCorrections(
      [
        correction({ wordIndex: 3, wordCount: 3 }),
        correction({ wordIndex: 4, wordCount: 1 }),
        correction({ wordIndex: 6, wordCount: 1 }),
      ],
      words,
    );
    expect(out.map((c) => c.original)).toEqual(["go to the", "store"]);
  });

  it("keeps back-to-back spans that touch without overlapping", () => {
    const out = resolveCorrections(
      [
        correction({ wordIndex: 2, wordCount: 2 }),
        correction({ wordIndex: 4, wordCount: 1 }),
      ],
      words,
    );
    expect(out).toHaveLength(2);
  });

  it("returns nothing for an empty transcript", () => {
    expect(resolveCorrections([correction()], [])).toEqual([]);
  });
});
