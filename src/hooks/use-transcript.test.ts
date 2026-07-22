import { describe, expect, it } from "vitest";
import { correctWordSpellings } from "@/hooks/use-transcript";
import type { TranscriptionDictionaryEntry } from "@/lib/studio/transcription-dictionary";
import type { Word } from "@/lib/studio/types";

const entry: TranscriptionDictionaryEntry = {
  id: "celpip",
  term: "CELPIP",
  aliases: ["South PIP"],
};

describe("correctWordSpellings", () => {
  it("keeps every word ID unique when a multi-token alias collapses", () => {
    const words: Word[] = [
      { id: "w-0", text: "South", start: 0, end: 0.2 },
      { id: "w-1", text: "PIP", start: 0.2, end: 0.5 },
      { id: "w-2", text: "practice", start: 0.6, end: 1 },
    ];

    const corrected = correctWordSpellings(words, [entry]);

    expect(corrected.map((word) => word.text)).toEqual(["CELPIP", "practice"]);
    expect(new Set(corrected.map((word) => word.id)).size).toBe(
      corrected.length,
    );
    expect(corrected[1].id).toBe("w-2");
    expect(corrected[0].id).not.toBe("w-2");
  });

  it("preserves the original ID for a one-token spelling correction", () => {
    const words: Word[] = [
      { id: "original", text: "celpip", start: 0, end: 0.5 },
    ];

    expect(correctWordSpellings(words, [entry])).toEqual([
      { id: "original", text: "CELPIP", start: 0, end: 0.5 },
    ]);
  });
});
