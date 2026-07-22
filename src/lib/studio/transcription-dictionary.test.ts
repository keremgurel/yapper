import { describe, expect, it } from "vitest";
import {
  applyTranscriptionDictionary,
  dictionaryKeyterms,
  findCaptionCorrection,
  type TranscriptionDictionaryEntry,
} from "@/lib/studio/transcription-dictionary";

const dictionary: TranscriptionDictionaryEntry[] = [
  {
    id: "celpip",
    term: "CELPIP",
    aliases: ["Salpip", "South PIP"],
  },
];

describe("findCaptionCorrection", () => {
  it("finds one changed word in a caption", () => {
    expect(
      findCaptionCorrection("a Salpip speaking app", "a CELPIP speaking app"),
    ).toEqual({ heard: "Salpip", term: "CELPIP" });
  });

  it("ignores punctuation-only edits and multi-word rewrites", () => {
    expect(findCaptionCorrection("hello world", "hello world.")).toBeNull();
    expect(
      findCaptionCorrection("one bad line", "one corrected sentence"),
    ).toBeNull();
  });
});

describe("applyTranscriptionDictionary", () => {
  it("uses the canonical spelling while retaining timings and punctuation", () => {
    expect(
      applyTranscriptionDictionary(
        [{ text: "Salpip,", start: 1, end: 1.5 }],
        dictionary,
      ),
    ).toEqual([{ text: "CELPIP,", start: 1, end: 1.5 }]);
  });

  it("matches a multi-word mishearing across ASR tokens", () => {
    expect(
      applyTranscriptionDictionary(
        [
          { text: "South", start: 2, end: 2.2 },
          { text: "PIP.", start: 2.2, end: 2.6 },
        ],
        dictionary,
      ),
    ).toEqual([{ text: "CELPIP.", start: 2, end: 2.6 }]);
  });
});

describe("dictionaryKeyterms", () => {
  it("sends canonical terms, not known mistakes, to the ASR", () => {
    expect(dictionaryKeyterms(dictionary)).toEqual(["CELPIP"]);
  });
});
