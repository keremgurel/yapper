import { describe, expect, it } from "vitest";
import { parseTrainingContext, parseTrainingScores } from "./parse";

const fullScores = {
  clarity: 70,
  language: 65,
  vocabulary: 60,
  delivery: 72,
  impact: 68,
  overall: 67,
};

describe("parseTrainingScores", () => {
  it("passes a complete score set through", () => {
    expect(parseTrainingScores(fullScores)).toEqual(fullScores);
  });

  it("rejects non-objects and partial sets", () => {
    expect(parseTrainingScores(null)).toBeNull();
    expect(parseTrainingScores("67")).toBeNull();
    expect(parseTrainingScores([fullScores])).toBeNull();
    expect(
      parseTrainingScores({ ...fullScores, overall: undefined }),
    ).toBeNull();
    expect(parseTrainingScores({ overall: 67 })).toBeNull();
  });

  it("rejects non-finite values", () => {
    expect(parseTrainingScores({ ...fullScores, clarity: NaN })).toBeNull();
    expect(parseTrainingScores({ ...fullScores, impact: "80" })).toBeNull();
  });

  it("clamps to 0-100 and rounds", () => {
    const parsed = parseTrainingScores({
      ...fullScores,
      clarity: 104,
      language: -3,
      vocabulary: 66.6,
    });
    expect(parsed).toMatchObject({ clarity: 100, language: 0, vocabulary: 67 });
  });
});

describe("parseTrainingContext", () => {
  it("passes a full context through", () => {
    const context = {
      drillSlug: "random-topic-generator",
      drillTitle: "Random topic generator",
      prompt: "Describe your favorite place",
      targetSeconds: 60,
      goals: ["interview-prep"],
    };
    expect(parseTrainingContext(context)).toEqual(context);
  });

  it("fills missing or mistyped fields with nulls", () => {
    expect(parseTrainingContext({ prompt: 42, targetSeconds: "60" })).toEqual({
      drillSlug: null,
      drillTitle: null,
      prompt: "",
      targetSeconds: null,
      goals: [],
    });
  });

  it("drops non-string goals", () => {
    expect(
      parseTrainingContext({ prompt: "p", goals: ["a", 3, null, "b"] }),
    ).toMatchObject({ goals: ["a", "b"] });
  });

  it("returns null for a non-object", () => {
    expect(parseTrainingContext(null)).toBeNull();
    expect(parseTrainingContext("prompt")).toBeNull();
  });
});
