import fixture from "./fixtures/ep12-coverage.json";
import type { SpeechRange } from "./coverage";
import { describe, expect, it } from "vitest";
import {
  recoverWords,
  uncoveredSpeech,
  mapTranscriptionWork,
} from "./coverage";

describe("independent speech coverage", () => {
  it("finds speech skipped between two apparently continuous sentence fragments", () => {
    const missing = uncoveredSpeech(
      [
        { text: "ads", start: 118.5, end: 119.27 },
        { text: "until", start: 121.63, end: 121.95 },
      ],
      [[120.125, 121.625]],
    );
    expect(missing).toHaveLength(1);
    expect(missing[0]![0]).toBe(120.125);
    expect(missing[0]![1]).toBeCloseTo(121.51);
  });

  it("does not mistake a word gap containing background noise for missing speech", () => {
    expect(uncoveredSpeech([], [])).toEqual([]);
    expect(
      uncoveredSpeech([{ text: "first", start: 0, end: 1 }], [[0.125, 1.125]]),
    ).toEqual([]);
  });

  it("checks leading and trailing speech and tolerates timestamp jitter", () => {
    expect(
      uncoveredSpeech(
        [{ text: "middle", start: 2, end: 3 }],
        [
          [0, 1],
          [2, 3.1],
          [4, 5],
        ],
      ),
    ).toEqual([
      [0, 1],
      [4, 5],
    ]);
  });

  it("keeps distinct repetitions and does not replace existing spelling", () => {
    const original = [
      { text: "CELPIP", start: 1, end: 1.3 },
      { text: "and", start: 2, end: 2.1 },
    ];
    const result = recoverWords(original, {
      offset: 0,
      duration: 5,
      heardSec: 5,
      words: [
        { text: "cell", start: 1, end: 1.3 },
        { text: "and", start: 2.01, end: 2.11 },
        { text: "and", start: 2.4, end: 2.5 },
      ],
    });
    expect(result.map((word) => word.text)).toEqual(["CELPIP", "and", "and"]);
  });

  it("cannot erase existing words when a retry omits them", () => {
    const original = [
      { text: "worked", start: 1, end: 1.2 },
      { text: "quite", start: 1.2, end: 1.4 },
      { text: "well", start: 1.4, end: 1.7 },
    ];
    expect(
      recoverWords(original, {
        offset: 0,
        duration: 5,
        heardSec: 5,
        words: [],
      }),
    ).toEqual(original);
  });

  it("bounds provider concurrency and preserves input order", async () => {
    let active = 0;
    let peak = 0;
    const values = await mapTranscriptionWork(
      [1, 2, 3, 4, 5],
      async (value) => {
        peak = Math.max(peak, ++active);
        await new Promise((resolve) => setTimeout(resolve, 5));
        active--;
        return value * 2;
      },
      2,
    );
    expect(peak).toBe(2);
    expect(values).toEqual([2, 4, 6, 8, 10]);
  });
});

describe("ep12 recorded ASR regression", () => {
  it("automatically restores the complete paid-ads take and every detected omission", () => {
    let words = fixture.words;
    const speech = fixture.speech as SpeechRange[];
    expect(uncoveredSpeech(words, speech)).toHaveLength(10);
    for (const pass of fixture.passes)
      for (const chunk of pass) words = recoverWords(words, chunk);
    expect(uncoveredSpeech(words, speech)).toEqual([]);
    expect(words).toHaveLength(1163);
    const finalTake = words.filter(
      (word) => word.start >= 119.9 && word.start < 125.5,
    );
    expect(
      finalTake
        .map((word) => word.text.toLowerCase().replace(/[.,]/g, ""))
        .join(" "),
    ).toBe(
      "and i only held off on paid ads until now because i wanted to see if i could crack distribution organically first",
    );
    expect(
      finalTake
        .slice(1)
        .every((word, index) => word.start - finalTake[index]!.end < 0.2),
    ).toBe(true);
    // The earlier opening is still in the transcript for the take selector.
    expect(
      words
        .filter((word) => word.start >= 116.8 && word.start < 119)
        .map((word) => word.text.toLowerCase())
        .join(" "),
    ).toBe("and i only held off on paid ads");
    // No previously recognized word may disappear, including a quiet "well".
    let next = 0;
    for (const word of words)
      if (word.text === fixture.words[next]?.text) next++;
    expect(next).toBe(fixture.words.length);
  });
});
