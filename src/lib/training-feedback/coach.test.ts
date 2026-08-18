import { describe, expect, it } from "vitest";
import {
  MAX_CORRECTIONS,
  MAX_LIST_ITEMS,
  MAX_STRUCTURAL_GAPS,
  MAX_UPGRADE_LINES,
  parseCoachingShot,
  parseScoringShot,
  sanitizeCoachingShot,
  sanitizeScoring,
} from "@/lib/training-feedback/coach";

describe("sanitizeScoring", () => {
  it("passes through a well-formed scoring shot", () => {
    const out = sanitizeScoring({
      scores: {
        clarity: 70,
        language: 55,
        vocabulary: 62,
        delivery: 48,
        impact: 40,
        overall: 56,
      },
      rationales: {
        clarity: "a",
        language: "b",
        vocabulary: "c",
        delivery: "d",
        impact: "e",
      },
    });
    expect(out.scores.overall).toBe(56);
    expect(out.rationales.impact).toBe("e");
  });

  it("clamps every score to 0-100 integers", () => {
    const out = sanitizeScoring({
      scores: {
        clarity: 150,
        language: -3,
        vocabulary: 73.6,
        delivery: Number.NaN,
        impact: "high",
        overall: Infinity,
      },
      rationales: {},
    });
    expect(out.scores).toEqual({
      clarity: 100,
      language: 0,
      vocabulary: 74,
      delivery: 0,
      impact: 0,
      overall: 0,
    });
  });

  it("defaults missing or malformed sections to zeros and empty strings", () => {
    const out = sanitizeScoring({ scores: "nope", rationales: 4 });
    expect(out.scores.clarity).toBe(0);
    expect(out.rationales.clarity).toBe("");
  });
});

const validCorrection = {
  type: "grammar",
  wordIndex: 2,
  wordCount: 1,
  fix: "went",
  note: "past tense",
};

describe("sanitizeCoachingShot", () => {
  it("keeps a well-formed shot intact", () => {
    const out = sanitizeCoachingShot({
      overview: "Solid rep.",
      strengths: ["clear claim"],
      improvements: ["close on the point"],
      corrections: [validCorrection],
      upgradeLines: [{ before: "um so", after: "So" }],
      polishedTranscript: "The polished answer.",
      structuralGaps: [
        { kind: "missing_close", severity: "high", note: "no ending" },
      ],
    });
    expect(out.strengths).toEqual(["clear claim"]);
    expect(out.corrections).toEqual([validCorrection]);
    expect(out.structuralGaps[0].kind).toBe("missing_close");
  });

  it("allows empty strengths rather than inventing them", () => {
    const out = sanitizeCoachingShot({ strengths: [] });
    expect(out.strengths).toEqual([]);
  });

  it("drops corrections with a bad type, non-integer span, or bad fix", () => {
    const out = sanitizeCoachingShot({
      corrections: [
        validCorrection,
        { ...validCorrection, type: "spelling" },
        { ...validCorrection, wordIndex: 1.5 },
        { ...validCorrection, wordCount: "two" },
        { ...validCorrection, fix: 7 },
        "nope",
        null,
      ],
    });
    expect(out.corrections).toEqual([validCorrection]);
  });

  it("accepts a null fix and coerces a malformed note to null", () => {
    const out = sanitizeCoachingShot({
      corrections: [
        { ...validCorrection, fix: null, note: 42 },
        { ...validCorrection, note: "x".repeat(400) },
      ],
    });
    expect(out.corrections[0].fix).toBeNull();
    expect(out.corrections[0].note).toBeNull();
    expect(out.corrections[1].note).toHaveLength(160);
  });

  it("never trusts the model's array lengths", () => {
    const out = sanitizeCoachingShot({
      strengths: Array(50).fill("s"),
      improvements: Array(50).fill("i"),
      corrections: Array(200).fill(validCorrection),
      upgradeLines: Array(50).fill({ before: "b", after: "a" }),
      structuralGaps: Array(10).fill({
        kind: "missing_hook",
        severity: "medium",
        note: "n",
      }),
    });
    expect(out.strengths).toHaveLength(MAX_LIST_ITEMS);
    expect(out.improvements).toHaveLength(MAX_LIST_ITEMS);
    expect(out.corrections).toHaveLength(MAX_CORRECTIONS);
    expect(out.upgradeLines).toHaveLength(MAX_UPGRADE_LINES);
    expect(out.structuralGaps).toHaveLength(MAX_STRUCTURAL_GAPS);
  });

  it("drops malformed upgrade lines and structural gaps", () => {
    const out = sanitizeCoachingShot({
      upgradeLines: [{ before: "x", after: "y" }, { before: "z" }, "nope"],
      structuralGaps: [
        { kind: "missing_intro", severity: "high", note: "n" },
        { kind: "missing_hook", severity: "extreme", note: "n" },
      ],
    });
    expect(out.upgradeLines).toEqual([{ before: "x", after: "y" }]);
    // An unknown severity degrades to medium; an unknown kind is dropped.
    expect(out.structuralGaps).toEqual([
      { kind: "missing_hook", severity: "medium", note: "n" },
    ]);
  });

  it("forces non-string prose fields to empty strings", () => {
    const out = sanitizeCoachingShot({ overview: 4, polishedTranscript: null });
    expect(out.overview).toBe("");
    expect(out.polishedTranscript).toBe("");
  });
});

describe("parse salvage", () => {
  it("reads JSON out of surrounding prose", () => {
    const out = parseScoringShot(
      'Sure: {"scores":{"clarity":80,"language":80,"vocabulary":80,' +
        '"delivery":80,"impact":80,"overall":81},"rationales":{}} done',
    );
    expect(out.scores.overall).toBe(81);
    expect(parseCoachingShot('```json\n{"overview":"Hi."}\n```').overview).toBe(
      "Hi.",
    );
  });

  it("throws when there is no JSON object to parse", () => {
    expect(() => parseScoringShot("no json")).toThrow("coach_unparseable");
    expect(() => parseCoachingShot("")).toThrow("coach_unparseable");
  });
});
