import { describe, expect, it } from "vitest";
import { scoreTrend } from "./trend";

describe("scoreTrend", () => {
  it("returns all nulls for an empty series", () => {
    expect(scoreTrend([])).toEqual({
      latest: null,
      latestAverage: null,
      earlierAverage: null,
      delta: null,
    });
  });

  it("has no comparison for a single score", () => {
    expect(scoreTrend([70])).toEqual({
      latest: 70,
      latestAverage: 70,
      earlierAverage: null,
      delta: null,
    });
  });

  it("has no comparison while the series fits inside the window", () => {
    const trend = scoreTrend([60, 62, 64, 66, 68]);
    expect(trend.latest).toBe(68);
    expect(trend.latestAverage).toBe(64);
    expect(trend.earlierAverage).toBeNull();
    expect(trend.delta).toBeNull();
  });

  it("compares the latest window against everything before it", () => {
    // earlier: 50, 52 (mean 51); latest 5: 60, 62, 64, 66, 68 (mean 64)
    const trend = scoreTrend([50, 52, 60, 62, 64, 66, 68]);
    expect(trend.latest).toBe(68);
    expect(trend.latestAverage).toBe(64);
    expect(trend.earlierAverage).toBe(51);
    expect(trend.delta).toBe(13);
  });

  it("reports a decline as a negative delta", () => {
    // earlier: 80, 80 (mean 80); latest: 70, 70 (mean 70)
    const trend = scoreTrend([80, 80, 70, 70], 2);
    expect(trend.delta).toBe(-10);
  });

  it("reports a flat series as a zero delta", () => {
    const trend = scoreTrend([70, 70, 70, 70, 70, 70], 5);
    expect(trend.delta).toBe(0);
  });

  it("rounds the delta from unrounded means", () => {
    // earlier mean 70; latest mean (71 + 72) / 2 = 71.5; delta 1.5 -> 2,
    // not round(72) - round(70) style drift.
    const trend = scoreTrend([70, 71, 72], 2);
    expect(trend.latestAverage).toBe(72);
    expect(trend.earlierAverage).toBe(70);
    expect(trend.delta).toBe(2);
  });

  it("treats a nonsense window as empty", () => {
    expect(scoreTrend([70, 72], 0).latest).toBeNull();
  });
});
