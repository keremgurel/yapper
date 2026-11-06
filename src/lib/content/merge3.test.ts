import { describe, expect, it } from "vitest";
import { merge3 } from "./merge3";

const merge = (base: string[], ours: string[], theirs: string[]) =>
  merge3(base, ours, theirs, Object.is);

describe("merge3", () => {
  it("takes the side that changed", () => {
    expect(merge(["a", "b"], ["a", "b"], ["a", "B"])).toEqual(["a", "B"]);
    expect(merge(["a", "b"], ["a", "B"], ["a", "b"])).toEqual(["a", "B"]);
    expect(merge(["a", "b"], ["a", "b"], ["a", "b"])).toEqual(["a", "b"]);
  });

  it("keeps an edit and someone else's new block together", () => {
    expect(
      merge(["a", "b", "c"], ["a", "B", "c"], ["a", "b", "c", "d"]),
    ).toEqual(["a", "B", "c", "d"]);
    expect(merge(["a", "b"], ["x", "a", "b"], ["a", "b", "y"])).toEqual([
      "x",
      "a",
      "b",
      "y",
    ]);
  });

  it("keeps a deletion on one side and an edit elsewhere on the other", () => {
    expect(merge(["a", "b", "c"], ["a", "c"], ["a", "b", "C"])).toEqual([
      "a",
      "C",
    ]);
  });

  it("lets our edit win where both changed the same block", () => {
    expect(
      merge(["a", "b", "c"], ["a", "mine", "c"], ["a", "theirs", "c"]),
    ).toEqual(["a", "mine", "c"]);
    expect(merge(["a"], ["same"], ["same"])).toEqual(["same"]);
  });

  it("handles empty lists", () => {
    expect(merge([], [], ["new"])).toEqual(["new"]);
    expect(merge([], ["mine"], ["theirs"])).toEqual(["mine", "theirs"]);
    expect(merge(["a"], ["a", "x"], ["a", "x"])).toEqual(["a", "x"]);
    expect(merge(["a"], [], ["a"])).toEqual([]);
  });
});

describe("merge3 in place", () => {
  it("merges edits to different blocks when neither side kept a block", () => {
    expect(merge(["a", "b"], ["a", "B"], ["A", "b"])).toEqual(["A", "B"]);
  });
});
