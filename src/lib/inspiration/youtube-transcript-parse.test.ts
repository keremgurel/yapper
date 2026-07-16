import { describe, expect, it } from "vitest";
import {
  extractArray,
  parseTimedText,
  pickTrack,
  type CaptionTrack,
} from "@/lib/inspiration/youtube-transcript-parse";

describe("extractArray", () => {
  it("bracket-matches a nested array, ignoring brackets inside strings", () => {
    const html = `x"captionTracks":[{"baseUrl":"a","runs":[1,2]},{"name":"] ["}]y`;
    expect(extractArray(html, "captionTracks")).toBe(
      `[{"baseUrl":"a","runs":[1,2]},{"name":"] ["}]`,
    );
  });

  it("respects escaped quotes inside a string literal", () => {
    const html = `"k":["a\\"]b","c"]`;
    expect(extractArray(html, "k")).toBe(`["a\\"]b","c"]`);
  });

  it("returns null when the key is missing or not an array", () => {
    expect(extractArray(`"other":[1]`, "captionTracks")).toBeNull();
    expect(extractArray(`"k":{"a":1}`, "k")).toBeNull();
  });
});

describe("pickTrack", () => {
  const t = (languageCode: string, kind?: string): CaptionTrack => ({
    baseUrl: `${languageCode}${kind ?? ""}`,
    languageCode,
    kind,
  });

  it("prefers a manual English track over an auto-generated one", () => {
    const picked = pickTrack([t("en", "asr"), t("es"), t("en")]);
    expect(picked?.kind).toBeUndefined();
    expect(picked?.languageCode).toBe("en");
  });

  it("falls back to any English, then to the first track", () => {
    expect(pickTrack([t("es"), t("en-GB", "asr")])?.languageCode).toBe("en-GB");
    expect(pickTrack([t("de"), t("fr")])?.languageCode).toBe("de");
    expect(pickTrack([])).toBeNull();
  });
});

describe("parseTimedText", () => {
  it("joins cues, strips inner markup, and decodes entities", () => {
    const xml =
      '<text start="0">Hello <b>there</b></text>' +
      '<text start="1">A &amp; B</text>';
    expect(parseTimedText(xml)).toBe("Hello there A & B");
  });

  it("keeps a cue that wraps across a newline inside the element", () => {
    // Real manual captions split a long cue onto two lines. Without dotAll the
    // whole cue fails to match and vanishes from the transcript.
    const xml = '<text start="0">So today we are\ngoing to cook</text>';
    expect(parseTimedText(xml)).toBe("So today we are going to cook");
  });

  it("returns null when nothing survives", () => {
    expect(parseTimedText("<transcript></transcript>")).toBeNull();
  });
});
