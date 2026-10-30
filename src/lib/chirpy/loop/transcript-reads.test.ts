import { expect, it } from "vitest";
import { readTranscript } from "./transcript-reads";

const transcript = [
  {
    mediaID: "A",
    text: "0:First 1:I 2:grind 3:the 4:coffee 5:beans. (pause 4.120-4.900) 6:Then [7:um] 8:I",
  },
  {
    mediaID: "B",
    text: "9:brew 10:the 11:coffee. [pause 9.000-9.500] 12:Done.",
  },
];

it("finds every occurrence of a phrase with its word numbers", () => {
  const result = readTranscript(transcript, { phrase: "the Coffee" }) as {
    found: number;
    occurrences: { occurrence: number; fromWord: number; toWord: number }[];
  };
  expect(result.found).toBe(2);
  expect(
    result.occurrences.map(({ occurrence, fromWord, toWord }) => ({
      occurrence,
      fromWord,
      toWord,
    })),
  ).toEqual([
    { occurrence: 1, fromWord: 3, toWord: 4 },
    { occurrence: 2, fromWord: 10, toWord: 11 },
  ]);
});

it("returns a word range in the original notation, cuts and pauses included, split by recording", () => {
  expect(readTranscript(transcript, { fromWord: 5, toWord: 10 })).toEqual({
    words: 13,
    fromWord: 5,
    toWord: 10,
    more: true,
    runs: [
      { mediaID: "A", text: "5:beans. (pause 4.120-4.900) 6:Then [7:um] 8:I" },
      { mediaID: "B", text: "9:brew 10:the" },
    ],
  });
});

it("reports a project without a transcript instead of an empty read", () => {
  expect(readTranscript(undefined, {})).toEqual({
    error: "This project has no transcript.",
  });
});
