import { describe, expect, it } from "vitest";
import { cutsFromCleanedText } from "@/lib/studio/align-transcript";

const words = (text: string) => text.split(" ").map((t) => ({ text: t }));

describe("cutsFromCleanedText", () => {
  it("cuts nothing when the cleaned text already matches the words", () => {
    expect(cutsFromCleanedText(words("hello world"), "hello world")).toEqual(
      [],
    );
  });

  it("keeps the LAST occurrence of a restated phrase, cutting the earlier one", () => {
    // "the cat" is said twice; the final take (indices 2-4) survives, the first
    // attempt (0-1) is cut. Aligning from the right is what lands on the keeper.
    expect(
      cutsFromCleanedText(words("the cat the cat sat"), "the cat sat"),
    ).toEqual([[0, 1]]);
  });

  it("cuts a leading stutter", () => {
    expect(cutsFromCleanedText(words("I I am here"), "I am here")).toEqual([
      [0, 0],
    ]);
  });

  it("matches case- and punctuation-insensitively", () => {
    // norm() lowercases and strips punctuation, so these align fully: no cuts.
    expect(cutsFromCleanedText(words("Hello, World!"), "hello world")).toEqual(
      [],
    );
  });

  it("never cuts a punctuation-only token, even between two cuts", () => {
    // The comma normalizes to empty; it is always kept, so it splits the removed
    // "um" and "uh" into two ranges rather than being swallowed into one.
    expect(cutsFromCleanedText(words("um , uh hello"), "hello")).toEqual([
      [0, 0],
      [2, 2],
    ]);
  });

  it("cuts every earlier word when only the tail survives", () => {
    expect(cutsFromCleanedText(words("a b c hello"), "hello")).toEqual([
      [0, 2],
    ]);
  });
});
