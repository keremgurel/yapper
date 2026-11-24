import { describe, expect, it } from "vitest";
import { SAMPLE_WORDS } from "../../samples/sample-take";
import { chunkWords } from "./chunk-words";

const word = (text: string, start: number, end: number) => ({
  text,
  start,
  end,
});

describe("chunkWords", () => {
  it("shows at most three words and closes at the end of a sentence", () => {
    expect(
      chunkWords(SAMPLE_WORDS, 3)
        .map((chunk) => chunk.text)
        .slice(0, 6),
    ).toEqual([
      "This is where",
      "your words show",
      "Two or three",
      "at a time",
      "right as you",
      "say them",
    ]);
  });

  it("holds a caption until the next one starts", () => {
    const chunks = chunkWords(
      [
        word("one", 0, 0.2),
        word("two", 0.3, 0.5),
        word("three", 0.6, 0.8),
        word("four", 0.9, 1.1),
      ],
      3,
    );
    expect(chunks).toEqual([
      { text: "one two three", start: 0, end: 0.9 },
      { text: "four", start: 0.9, end: 1.1 },
    ]);
  });

  it("ends a caption before a pause instead of holding it through", () => {
    const chunks = chunkWords([word("wait", 0, 0.3), word("okay", 2, 2.3)], 3);
    expect(chunks).toEqual([
      { text: "wait", start: 0, end: 0.3 },
      { text: "okay", start: 2, end: 2.3 },
    ]);
  });

  it("drops sentence punctuation and keeps marks inside a word", () => {
    const chunks = chunkWords(
      [
        word("of", 0, 0.1),
        word("$1,200,", 0.1, 0.5),
        word("we're", 0.5, 0.7),
        word("done!", 0.7, 0.9),
      ],
      4,
    );
    expect(chunks[0].text).toBe("of $1,200 we're done");
  });

  it("returns nothing for no words", () => {
    expect(chunkWords([], 3)).toEqual([]);
  });
});
