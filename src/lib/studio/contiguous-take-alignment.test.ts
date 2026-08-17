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

  it("keeps the first word of the final take when earlier takes open the same way", () => {
    const source = words(
      "Stop trying to memorize full CELPIP speaking answers. " +
        "Stop trying to memorize full CELPIP speaking answers and try these templates instead.",
    );
    const result = alignCleanedToContiguousTakes(
      source,
      "Stop trying to memorize full CELPIP speaking answers and try these templates instead.",
    );

    expect(result.keep).toEqual([[8, 20]]);
    expect(source[8].text).toBe("Stop");
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

describe("short thoughts the cleaner reworded slightly", () => {
  // From a real recording. The speaker ran the line several times and the
  // cleaner returned the last one with "and we" added at the front of its
  // second sentence. Two words out of nine is 22%, over the proportional
  // bound, so that sentence found no home and vanished: the finished video
  // ended mid-phrase on "happy and" and lost the rest of the take.
  const source = words(
    "And the two users that messaged me ended the conversation happily " +
      "and the two users that messaged me ended the conversation happy and " +
      "might even get some reviews out of them. " +
      "So it ended up working very well.",
  );

  it("keeps a sentence the cleaner opened with a couple of small words", () => {
    const result = alignCleanedToContiguousTakes(
      source,
      "And the two users that messaged me ended the conversation happy and, " +
        "and we might even get some reviews out of them. " +
        "So it ended up working very well.",
    );
    const kept = result.keep
      .flatMap(([start, end]) => source.slice(start, end + 1))
      .map(({ text }) => text)
      .join(" ");
    expect(kept).toContain("might even get some reviews out of them.");
    expect(kept).toContain("So it ended up working very well.");
    expect(result.coverage).toBeGreaterThanOrEqual(0.92);
  });

  it("still refuses a short generic phrase it cannot really place", () => {
    const result = alignCleanedToContiguousTakes(
      words("So it ended up working very well."),
      "Totally different.",
    );
    expect(result.keep).toEqual([]);
  });
});
