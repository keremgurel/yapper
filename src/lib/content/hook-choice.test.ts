import { describe, expect, it } from "vitest";
import { chooseHook, chosenHook } from "@/lib/content/hook-choice";
import type { ContentHook } from "@/lib/db/schema";

const hook = (text: string): ContentHook => ({
  text,
  pattern: null,
  why: null,
});
const list = [hook("a"), hook("b"), hook("c")];

describe("chooseHook", () => {
  it("moves the picked hook to the front", () => {
    expect(chooseHook(list, 2).map((h) => h.text)).toEqual(["c", "a", "b"]);
  });

  /** The shortlist is the point: the options you rejected are what you compare
   * against when the chosen one stops feeling right. */
  it("keeps every other hook, in order", () => {
    expect(chooseHook(list, 1)).toHaveLength(3);
    expect(chooseHook(list, 1).map((h) => h.text)).toEqual(["b", "a", "c"]);
  });

  it("is a no-op when the pick is already first", () => {
    expect(chooseHook(list, 0)).toBe(list);
  });

  it("is a no-op for an index that is not there", () => {
    expect(chooseHook(list, 9)).toBe(list);
    expect(chooseHook(list, -1)).toBe(list);
  });

  it("does not mutate the input", () => {
    chooseHook(list, 2);
    expect(list.map((h) => h.text)).toEqual(["a", "b", "c"]);
  });
});

describe("chosenHook", () => {
  it("is the first hook with any text", () => {
    expect(chosenHook(list)?.text).toBe("a");
    // A blank first row is a half-typed one, not the creator's choice.
    expect(chosenHook([hook("  "), hook("real")])?.text).toBe("real");
  });

  it("is null when nothing has been written", () => {
    expect(chosenHook([])).toBeNull();
    expect(chosenHook([hook("")])).toBeNull();
  });
});
