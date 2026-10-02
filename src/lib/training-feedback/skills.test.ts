import { describe, expect, it } from "vitest";
import { skillReasons, skillScores } from "./skills";

const scores = {
  clarity: 80,
  language: 60,
  vocabulary: 70,
  delivery: 50,
  impact: 40,
  overall: 62,
};
const pronunciation = {
  accuracy: 90,
  fluency: 80,
  prosody: 66,
  monotoneShare: 20,
  assessedSeconds: 30,
  words: [],
};

describe("deriving the four skills", () => {
  it("uses the coach's scores alone when the audio was not assessed", () => {
    expect(skillScores(scores)).toEqual({
      clear: 64, // 60 * 0.6 + 70 * 0.4
      fluent: 50,
      expressive: null,
      structured: 64, // 80 * 0.6 + 40 * 0.4
    });
  });

  it("counts what was measured from the audio when there is a report", () => {
    expect(skillScores(scores, pronunciation)).toEqual({
      clear: 75, // 90 * 0.4 + 60 * 0.35 + 70 * 0.25 = 74.5
      fluent: 62, // 50 * 0.6 + 80 * 0.4
      expressive: 66,
      structured: 64,
    });
  });

  it("leaves expressive empty when intonation was not scored", () => {
    expect(
      skillScores(scores, { ...pronunciation, prosody: null }).expressive,
    ).toBeNull();
  });

  it("keeps every skill inside 0 to 100 at the extremes", () => {
    const top = {
      ...scores,
      clarity: 100,
      language: 100,
      vocabulary: 100,
      delivery: 100,
      impact: 100,
    };
    const full = {
      ...pronunciation,
      accuracy: 100,
      fluency: 100,
      prosody: 100,
    };
    expect(skillScores(top, full)).toEqual({
      clear: 100,
      fluent: 100,
      expressive: 100,
      structured: 100,
    });
  });
});

describe("grouping the coach's reasons under each skill", () => {
  it("joins the reasons that explain one skill", () => {
    expect(
      skillReasons({
        clarity: "The point came late.",
        language: "Two tense slips.",
        vocabulary: "Plain but precise.",
        delivery: "Steady pace.",
        impact: "The ending trailed off.",
      }),
    ).toEqual({
      clear: "Two tense slips. Plain but precise.",
      fluent: "Steady pace.",
      expressive: "",
      structured: "The point came late. The ending trailed off.",
    });
  });

  it("copes with missing reasons", () => {
    expect(skillReasons(null).clear).toBe("");
    expect(skillReasons({ language: "  ", vocabulary: "Fine." }).clear).toBe(
      "Fine.",
    );
  });
});
