import { describe, expect, it } from "vitest";
import { parsePronunciation } from "./parse";

const valid = {
  accuracy: 84,
  fluency: 71,
  prosody: 63,
  monotoneShare: 41,
  assessedSeconds: 31,
  words: [{ text: "schedule", accuracy: 40, start: 3.14, sound: "jh" }],
};

describe("reading a pronunciation report sent by the browser", () => {
  it("accepts a well-formed report", () => {
    expect(parsePronunciation(valid)).toEqual({
      ...valid,
      words: [{ text: "schedule", accuracy: 40, start: 3.1, sound: "jh" }],
    });
  });

  it("clamps scores and the assessed length to their ranges", () => {
    const report = parsePronunciation({
      ...valid,
      accuracy: 250,
      fluency: -4,
      monotoneShare: 400,
      assessedSeconds: 99_999,
    });
    expect(report).toMatchObject({
      accuracy: 100,
      fluency: 0,
      monotoneShare: 100,
      assessedSeconds: 100,
    });
  });

  it("rejects a report without its core scores", () => {
    for (const bad of [
      null,
      "report",
      {},
      { ...valid, accuracy: "high" },
      { ...valid, fluency: Number.NaN },
      { ...valid, assessedSeconds: 0 },
    ])
      expect(parsePronunciation(bad)).toBeNull();
  });

  it("drops malformed words, trims long ones and caps the list", () => {
    const report = parsePronunciation({
      ...valid,
      prosody: undefined,
      words: [
        { text: "", accuracy: 10 },
        { text: "ok" },
        "word",
        { text: "x".repeat(200), accuracy: 12, start: -5, sound: 7 },
        ...Array.from({ length: 30 }, (_, i) => ({
          text: `w${i}`,
          accuracy: 20,
          start: i,
        })),
      ],
    });
    expect(report?.prosody).toBeNull();
    expect(report?.words).toHaveLength(7);
    expect(report?.words[0]).toEqual({
      text: "x".repeat(40),
      accuracy: 12,
      start: 0,
      sound: null,
    });
  });
});
