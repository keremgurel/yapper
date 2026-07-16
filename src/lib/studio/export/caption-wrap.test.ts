import { describe, expect, it } from "vitest";
import { wrapLines } from "@/lib/studio/export/caption-wrap";

// A stand-in for the canvas text measurer: one unit of width per character, so
// `maxWidth` reads as "characters per line" and the cases stay easy to reason
// about. A space counts as a character, exactly as the real measureText sees it.
const byChar = (s: string) => s.length;

describe("wrapLines", () => {
  it("greedily fills each line up to the width, then breaks", () => {
    // "aa bb" is 5 chars (fits); "aa bb cc" is 8 (over), so cc starts line 2.
    expect(wrapLines(byChar, "aa bb cc dd", 5)).toEqual(["aa bb", "cc dd"]);
  });

  it("keeps explicit newlines as separate lines", () => {
    expect(wrapLines(byChar, "aa\nbb", 100)).toEqual(["aa", "bb"]);
  });

  it("preserves a blank line between paragraphs", () => {
    expect(wrapLines(byChar, "aa\n\nbb", 100)).toEqual(["aa", "", "bb"]);
  });

  it("leaves a single over-wide word whole on its own line, not split", () => {
    // "aaaaaa" (6) is wider than the 3-char box but a word can't be broken, so
    // it overflows on its own line and the next word wraps after it.
    expect(wrapLines(byChar, "aaaaaa bb", 3)).toEqual(["aaaaaa", "bb"]);
  });

  it("collapses runs of whitespace like the browser does", () => {
    expect(wrapLines(byChar, "aa   bb", 100)).toEqual(["aa bb"]);
  });
});
