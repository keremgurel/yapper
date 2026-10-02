import { describe, expect, it } from "vitest";
import { summarizePronunciation, type AzureSegment } from "./summarize";

const SECOND = 10_000_000;
const word = (
  text: string,
  accuracy: number,
  at: number,
  extra: { monotone?: boolean; phonemes?: [string, number][] } = {},
) => ({
  Word: text,
  Offset: at * SECOND,
  PronunciationAssessment: {
    AccuracyScore: accuracy,
    Feedback: {
      Prosody: {
        Intonation: { ErrorTypes: extra.monotone ? ["Monotone"] : [] },
      },
    },
  },
  Phonemes: (extra.phonemes ?? []).map(([Phoneme, AccuracyScore]) => ({
    Phoneme,
    PronunciationAssessment: { AccuracyScore },
  })),
});
const segment = (
  seconds: number,
  scores: [number, number, number?],
  words: ReturnType<typeof word>[],
): AzureSegment => ({
  Duration: seconds * SECOND,
  NBest: [
    {
      PronunciationAssessment: {
        AccuracyScore: scores[0],
        FluencyScore: scores[1],
        ...(scores[2] === undefined ? {} : { ProsodyScore: scores[2] }),
      },
      Words: words,
    },
  ],
});

describe("summarizing a pronunciation assessment", () => {
  it("weights each phrase by how long it lasted", () => {
    const report = summarizePronunciation([
      segment(9, [90, 80, 70], [word("hello", 90, 0)]),
      segment(1, [40, 30, 20], [word("there", 90, 9)]),
    ]);
    expect(report).toMatchObject({
      accuracy: 85,
      fluency: 75,
      prosody: 65,
      assessedSeconds: 10,
    });
  });

  it("lists unclear words worst first, with the weakest sound and the time", () => {
    const report = summarizePronunciation([
      segment(
        5,
        [70, 70, 70],
        [
          word("fine", 95, 0),
          word("thoroughly", 55, 1.26, {
            phonemes: [
              ["th", 30],
              ["er", 80],
            ],
          }),
          word("schedule", 40, 3),
        ],
      ),
    ]);
    expect(report?.words).toEqual([
      { text: "schedule", accuracy: 40, start: 3, sound: null },
      { text: "thoroughly", accuracy: 55, start: 1.3, sound: "th" },
    ]);
  });

  it("keeps only the worst take of a repeated word", () => {
    const report = summarizePronunciation([
      segment(
        4,
        [70, 70, 70],
        [word("Really", 60, 0), word("really", 35, 2), word("really", 50, 3)],
      ),
    ]);
    expect(report?.words).toEqual([
      { text: "really", accuracy: 35, start: 2, sound: null },
    ]);
  });

  it("reports the share of words said in a flat pitch", () => {
    const report = summarizePronunciation([
      segment(
        4,
        [90, 90, 60],
        [
          word("a", 90, 0, { monotone: true }),
          word("b", 90, 1),
          word("c", 90, 2),
          word("d", 90, 3),
        ],
      ),
    ]);
    expect(report?.monotoneShare).toBe(25);
  });

  it("leaves intonation empty when the service did not score it", () => {
    const report = summarizePronunciation([
      segment(3, [90, 90], [word("hello", 90, 0)]),
    ]);
    expect(report?.prosody).toBeNull();
  });

  it("returns nothing when no speech was recognised", () => {
    expect(summarizePronunciation([])).toBeNull();
    expect(summarizePronunciation([{ Duration: 0, NBest: [] }])).toBeNull();
    expect(summarizePronunciation([segment(3, [90, 90, 90], [])])).toBeNull();
  });
});
