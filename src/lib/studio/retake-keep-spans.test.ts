import { describe, expect, it } from "vitest";
import { cutsFromKeptSpans } from "./retake-keep-spans";

const answer = (keep: unknown) => JSON.stringify({ keep });

describe("cutsFromKeptSpans", () => {
  it("deletes everything outside the kept spans", () => {
    expect(
      cutsFromKeptSpans(
        answer([
          [3, 5],
          [10, 19],
        ]),
        20,
      ),
    ).toEqual([
      [0, 2],
      [6, 9],
    ]);
  });

  it("reads an answer wrapped in prose or a code fence", () => {
    expect(
      cutsFromKeptSpans(
        "Here is the edit:\n```json\n" + answer([[5, 9]]) + "\n```",
        10,
      ),
    ).toEqual([[0, 4]]);
  });

  it("keeps everything when the model lists the whole take", () => {
    expect(cutsFromKeptSpans(answer([[0, 19]]), 20)).toEqual([]);
  });

  it("merges spans that overlap, touch, or arrive out of order", () => {
    expect(
      cutsFromKeptSpans(
        answer([
          [12, 19],
          [4, 8],
          [7, 11],
        ]),
        20,
      ),
    ).toEqual([[0, 3]]);
  });

  it("clamps the one-past-the-end fencepost and swaps a reversed pair", () => {
    expect(cutsFromKeptSpans(answer([[10, 20]]), 20)).toEqual([[0, 9]]);
    expect(cutsFromKeptSpans(answer([[19, 10]]), 20)).toEqual([[0, 9]]);
  });

  it("refuses a span that points outside the transcript", () => {
    expect(
      cutsFromKeptSpans(
        answer([
          [0, 4],
          [5, 99],
        ]),
        20,
      ),
    ).toBeNull();
    expect(cutsFromKeptSpans(answer([[-1, 4]]), 20)).toBeNull();
  });

  it("refuses an answer that would delete the video", () => {
    expect(cutsFromKeptSpans(answer([[99, 99]]), 100)).toBeNull();
    expect(cutsFromKeptSpans(answer([[0, 13]]), 100)).toBeNull();
    expect(cutsFromKeptSpans(answer([[0, 14]]), 100)).toEqual([[15, 99]]);
  });

  it("refuses anything that is not the shape it asked for", () => {
    expect(cutsFromKeptSpans("no json here", 20)).toBeNull();
    expect(cutsFromKeptSpans("{ not json", 20)).toBeNull();
    expect(cutsFromKeptSpans(JSON.stringify({}), 20)).toBeNull();
    expect(cutsFromKeptSpans(answer([]), 20)).toBeNull();
    expect(cutsFromKeptSpans(answer([0, 4]), 20)).toBeNull();
    expect(cutsFromKeptSpans(answer([[0, 4, 6]]), 20)).toBeNull();
    expect(cutsFromKeptSpans(answer([["0", "4"]]), 20)).toBeNull();
    expect(
      cutsFromKeptSpans(JSON.stringify({ blocks: [{ keep: [[0, 4]] }] }), 20),
    ).toBeNull();
  });
});
