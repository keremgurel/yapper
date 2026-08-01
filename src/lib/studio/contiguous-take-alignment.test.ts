import { describe, expect, it } from "vitest";
import {
  alignCleanedToContiguousTakes,
  cutsOutsideKeptTakes,
} from "@/lib/studio/contiguous-take-alignment";

const words = (text: string) =>
  text.split(/\s+/).map((token) => ({ text: token }));

describe("alignCleanedToContiguousTakes", () => {
  it("chooses the last whole take instead of splicing matching fragments", () => {
    const source = words(
      "You can take full practice test, drill nope. " +
        "You can take mock exams. " +
        "You can take full practice tests, drill individual questions.",
    );
    const result = alignCleanedToContiguousTakes(
      source,
      "You can take full practice tests, drill individual questions.",
    );
    expect(
      result.keep.flatMap(([start, end]) =>
        source.slice(start, end + 1).map(({ text }) => text),
      ),
    ).toEqual(
      words(
        "You can take full practice tests, drill individual questions.",
      ).map(({ text }) => text),
    );
    expect(result.coverage).toBe(1);
  });

  it("maps reordered model sentences back in source chronology", () => {
    const source = words("second sentence. first sentence.");
    const result = alignCleanedToContiguousTakes(
      source,
      "first sentence. second sentence.",
    );
    expect(result.keep).toEqual([[0, 3]]);
  });

  it("splits a model-joined clause only when both halves are safe", () => {
    const source = words(
      "I looked closely at every platform, bad restart words. " +
        "and I can wholeheartedly recommend this.",
    );
    const result = alignCleanedToContiguousTakes(
      source,
      "I looked closely at every platform, and I can wholeheartedly recommend this.",
    );
    expect(result.keep).toEqual([
      [0, 5],
      [9, 14],
    ]);
  });

  it("uses a later corrected sentence tail instead of the first occurrence", () => {
    const source = words(
      "To kick off the launch, the first members get access forever, " +
        "plus eight free credits to try AI feedback. " +
        "Plus eight free credits to try the AI feedback. So comment founder.",
    );
    const result = alignCleanedToContiguousTakes(
      source,
      "To kick off the launch, the first members get access forever, " +
        "plus eight free credits to try AI feedback. So comment founder.",
    );
    const kept = result.keep.flatMap(([start, end]) =>
      source.slice(start, end + 1).map(({ text }) => text),
    );

    expect(kept).toEqual(
      words(
        "To kick off the launch, the first members get access forever, " +
          "Plus eight free credits to try the AI feedback. So comment founder.",
      ).map(({ text }) => text),
    );
    expect(result.coverage).toBe(1);
  });

  it("turns kept spans into the complement cut ranges", () => {
    expect(
      cutsOutsideKeptTakes(12, [
        [2, 4],
        [8, 9],
      ]),
    ).toEqual([
      [0, 1],
      [5, 7],
      [10, 11],
    ]);
  });
});
