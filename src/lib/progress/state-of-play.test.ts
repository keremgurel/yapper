import { describe, expect, it } from "vitest";
import { stateOfPlay } from "./state-of-play";
import type { ProgressStats } from "./types";

function stats(overrides: Partial<ProgressStats>): ProgressStats {
  return {
    totalReps: 10,
    coachedReps: 8,
    minutesPracticed: 24,
    dayStreak: 0,
    bestOverall: 74,
    latestOverall: 70,
    earlierAverage: 64,
    overallDelta: 6,
    ...overrides,
  };
}

describe("stateOfPlay", () => {
  it("invites the first rep when there is nothing", () => {
    expect(stateOfPlay(stats({ totalReps: 0 }))).toBe(
      "Nothing on the record yet. Your first coached rep starts it.",
    );
  });

  it("explains missing scores when reps exist but none were coached", () => {
    expect(stateOfPlay(stats({ coachedReps: 0, latestOverall: null }))).toBe(
      "Reps recorded. Scores show up after your first coached rep.",
    );
  });

  it("states a gain", () => {
    expect(stateOfPlay(stats({ overallDelta: 6 }))).toBe(
      "Latest score 70, up 6 on your earlier average.",
    );
  });

  it("states a decline just as plainly", () => {
    expect(stateOfPlay(stats({ overallDelta: -4 }))).toBe(
      "Latest score 70, down 4 on your earlier average.",
    );
  });

  it("states a flat comparison", () => {
    expect(stateOfPlay(stats({ overallDelta: 0 }))).toBe(
      "Latest score 70, level with your earlier average.",
    );
  });

  it("omits the comparison before there is an earlier window", () => {
    expect(
      stateOfPlay(stats({ overallDelta: null, earlierAverage: null })),
    ).toBe("Latest score 70.");
  });

  it("appends a streak of two or more days", () => {
    expect(stateOfPlay(stats({ dayStreak: 3 }))).toBe(
      "Latest score 70, up 6 on your earlier average. 3 days running.",
    );
    expect(stateOfPlay(stats({ dayStreak: 1 }))).toBe(
      "Latest score 70, up 6 on your earlier average.",
    );
  });
});
