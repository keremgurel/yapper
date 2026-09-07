import { describe, expect, it } from "vitest";
import {
  loadRecordedTranscript,
  transcriptJsonToText,
} from "./recorded-transcript";

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

describe("legacy Poster transcript recovery", () => {
  it("reads speech from older uploads but never from someone else's inspiration", async () => {
    expect(
      await loadRecordedTranscript("owner", {
        sourceUrl: "yapper://poster-upload",
        sourceTranscript: "Actual uploaded speech",
      }),
    ).toBe("Actual uploaded speech");
    expect(
      await loadRecordedTranscript("owner", {
        sourceUrl: "https://instagram.com/reel/inspiration",
        sourceTranscript: "Someone else's words",
      }),
    ).toBeNull();
  });
  it("prefers the current recorded transcript", async () => {
    expect(
      await loadRecordedTranscript("owner", {
        recordedTranscript: "New export",
        sourceUrl: "yapper://poster-upload",
        sourceTranscript: "Old export",
      }),
    ).toBe("New export");
  });
});
