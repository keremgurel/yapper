import { describe, expect, it } from "vitest";
import type { DeliveryMetrics } from "@/lib/feedback/metrics";
import type { TrainingScores } from "@/lib/training-feedback/types";
import { changeDirection, compareAttempts } from "./attempt-comparison";

const scores = (overall: number) => ({ overall }) as TrainingScores;
const metrics = (m: Partial<DeliveryMetrics>) => m as DeliveryMetrics;

describe("comparing two attempts at the same prompt", () => {
  it("reads each measure in the direction that matters", () => {
    const changes = compareAttempts(
      { scores: scores(60), metrics: metrics({ fillerPerMin: 6 }) },
      { scores: scores(71), metrics: metrics({ fillerPerMin: 2 }) },
    );
    expect(changes.map((c) => [c.label, changeDirection(c)])).toEqual([
      ["Overall score", "improved"],
      ["Fillers per minute", "improved"],
    ]);
  });
  it("calls more fillers worse and no change the same", () => {
    const [score, fillers] = compareAttempts(
      { scores: scores(70), metrics: metrics({ fillerPerMin: 1 }) },
      { scores: scores(70), metrics: metrics({ fillerPerMin: 4 }) },
    );
    expect(changeDirection(score)).toBe("same");
    expect(changeDirection(fillers)).toBe("worse");
  });
  it("skips a measure the older attempt did not record", () => {
    const changes = compareAttempts(
      { scores: scores(60), metrics: metrics({}) },
      { scores: scores(65), metrics: metrics({ midSentencePauseCount: 3 }) },
    );
    expect(changes.map((c) => c.label)).toEqual(["Overall score"]);
  });
});
