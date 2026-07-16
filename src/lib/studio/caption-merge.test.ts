import { describe, expect, it } from "vitest";
import { mergeCaptionsById } from "@/lib/studio/caption-merge";
import type { Caption } from "@/lib/studio/types";

const cap = (id: string, text: string, ss: number, se: number): Caption => ({
  id,
  text,
  sourceStart: ss,
  sourceEnd: se,
});

describe("mergeCaptionsById", () => {
  it("merges into one caption spanning the full source range, text in time order", () => {
    const captions = [
      cap("a", "world", 5, 6),
      cap("b", "hello", 2, 3), // earlier in source, so its text comes first
      cap("c", "other", 10, 11), // not merged
    ];
    const out = mergeCaptionsById(captions, new Set(["a", "b"]));
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({
      sourceStart: 2,
      sourceEnd: 6,
      text: "hello world",
    });
    expect(out[1].id).toBe("c"); // untouched, and the list stays source-sorted
  });

  it("drops blank pieces from the joined text", () => {
    const out = mergeCaptionsById(
      [cap("a", "one", 2, 3), cap("b", "  ", 4, 5), cap("c", "two", 6, 7)],
      new Set(["a", "b", "c"]),
    );
    expect(out[0].text).toBe("one two");
    expect(out[0].sourceEnd).toBe(7);
  });

  it("is a no-op by reference when fewer than two targets are present", () => {
    const captions = [cap("a", "one", 2, 3), cap("b", "two", 4, 5)];
    expect(mergeCaptionsById(captions, new Set(["a"]))).toBe(captions);
    expect(mergeCaptionsById(captions, new Set())).toBe(captions);
  });
});
