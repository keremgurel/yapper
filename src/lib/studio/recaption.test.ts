import { describe, expect, it } from "vitest";
import { editedWordsToSourceWords } from "@/lib/studio/recaption";
import type { Clip } from "@/lib/studio/types";

describe("editedWordsToSourceWords", () => {
  it("maps a retranscribed edited timeline back across removed source ranges", () => {
    const clips: Clip[] = [
      { id: "a", start: 10, end: 12 },
      { id: "b", start: 20, end: 23 },
    ];
    const words = editedWordsToSourceWords(
      [
        { text: "first", start: 0.5, end: 1 },
        { text: "second", start: 2.5, end: 3 },
      ],
      clips,
    );

    expect(words.map(({ text, start, end }) => ({ text, start, end }))).toEqual(
      [
        { text: "first", start: 10.5, end: 11 },
        { text: "second", start: 20.5, end: 21 },
      ],
    );
  });

  it("preserves timeline order when clips were manually reordered", () => {
    const clips: Clip[] = [
      { id: "later", start: 20, end: 22 },
      { id: "earlier", start: 2, end: 4 },
    ];
    const words = editedWordsToSourceWords(
      [
        { text: "now-first", start: 0.2, end: 0.8 },
        { text: "now-second", start: 2.2, end: 2.8 },
      ],
      clips,
    );

    expect(words.map((word) => word.start)).toEqual([20.2, 2.2]);
  });
});
