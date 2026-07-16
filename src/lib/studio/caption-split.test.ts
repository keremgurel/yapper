import { describe, expect, it } from "vitest";
import {
  splitCaptionAtTime,
  splitCaptionAtWordIndex,
} from "@/lib/studio/caption-split";
import type { Caption } from "@/lib/studio/types";

const cap = (
  text: string,
  sourceStart: number,
  sourceEnd: number,
): Caption => ({
  id: "c1",
  text,
  sourceStart,
  sourceEnd,
});

describe("splitCaptionAtTime", () => {
  it("divides the words at the boundary and splits the source span there", () => {
    const out = splitCaptionAtTime(cap("one two three four", 0, 4), 2);
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({
      text: "one two",
      sourceStart: 0,
      sourceEnd: 2,
    });
    expect(out[1]).toMatchObject({
      text: "three four",
      sourceStart: 2,
      sourceEnd: 4,
    });
  });

  it("never splits a single-word caption into an empty ghost", () => {
    const single = cap("hello", 0, 2);
    expect(splitCaptionAtTime(single, 1)).toEqual([single]);
  });

  it("leaves the caption whole when the cut lands within 0.05s of an edge", () => {
    const c = cap("one two", 0, 4);
    expect(splitCaptionAtTime(c, 0.02)).toEqual([c]);
    expect(splitCaptionAtTime(c, 3.99)).toEqual([c]);
  });

  it("gives fresh ids to both halves so they are distinct captions", () => {
    const out = splitCaptionAtTime(cap("one two", 0, 4), 2);
    expect(out[0].id).not.toBe("c1");
    expect(out[1].id).not.toBe(out[0].id);
  });
});

describe("splitCaptionAtWordIndex", () => {
  it("keeps `wordsBefore` words in the head and times the cut by word count", () => {
    const out = splitCaptionAtWordIndex(cap("a b c d", 0, 8), 1);
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ text: "a", sourceStart: 0, sourceEnd: 2 });
    expect(out[1]).toMatchObject({
      text: "b c d",
      sourceStart: 2,
      sourceEnd: 8,
    });
  });

  it("refuses to split a single-word caption", () => {
    const single = cap("hello", 0, 2);
    expect(splitCaptionAtWordIndex(single, 1)).toEqual([single]);
  });

  it("clamps an out-of-range word index into a real boundary", () => {
    const out = splitCaptionAtWordIndex(cap("a b c", 0, 3), 99);
    expect(out).toHaveLength(2);
    expect(out[0].text).toBe("a b"); // clamped to parts.length - 1 = 2
    expect(out[1].text).toBe("c");
  });
});
