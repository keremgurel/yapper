import { describe, expect, it } from "vitest";
import { transcriptJsonToText } from "./recorded-transcript";

describe("transcriptJsonToText", () => {
  it("reads strings, word lists, and envelopes", () => {
    expect(transcriptJsonToText(" hello there ")).toBe("hello there");
    expect(transcriptJsonToText([{ text: "a" }, { text: " b" }, "c"])).toBe(
      "a b c",
    );
    expect(transcriptJsonToText({ words: [{ text: "x" }, { start: 1 }] })).toBe(
      "x",
    );
  });
  it("is empty for anything else", () => {
    expect(transcriptJsonToText(null)).toBe("");
    expect(transcriptJsonToText(42)).toBe("");
    expect(transcriptJsonToText({})).toBe("");
  });
});
