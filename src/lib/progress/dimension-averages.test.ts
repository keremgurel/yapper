import { describe, expect, it } from "vitest";
import { dimensionAverages } from "./dimension-averages";

const DIMS = ["clarity", "delivery"] as const;

describe("dimensionAverages", () => {
  it("returns nulls for every dimension with no records", () => {
    expect(dimensionAverages([], DIMS)).toEqual({
      clarity: { average: null, delta: null },
      delivery: { average: null, delta: null },
    });
  });

  it("averages a single record with no comparison", () => {
    const result = dimensionAverages([{ clarity: 60, delivery: 70 }], DIMS);
    expect(result.clarity).toEqual({ average: 60, delta: null });
    expect(result.delivery).toEqual({ average: 70, delta: null });
  });

  it("has no delta while everything fits in the window", () => {
    const records = [
      { clarity: 60, delivery: 70 },
      { clarity: 64, delivery: 66 },
    ];
    const result = dimensionAverages(records, DIMS, 5);
    expect(result.clarity).toEqual({ average: 62, delta: null });
    expect(result.delivery).toEqual({ average: 68, delta: null });
  });

  it("splits latest window from earlier and moves per dimension", () => {
    const records = [
      // earlier
      { clarity: 50, delivery: 80 },
      { clarity: 54, delivery: 80 },
      // latest window of 2
      { clarity: 70, delivery: 74 },
      { clarity: 74, delivery: 78 },
    ];
    const result = dimensionAverages(records, DIMS, 2);
    // clarity improved: 72 now vs 52 earlier.
    expect(result.clarity).toEqual({ average: 72, delta: 20 });
    // delivery slipped: 76 now vs 80 earlier.
    expect(result.delivery).toEqual({ average: 76, delta: -4 });
  });

  it("rounds averages and deltas from unrounded means", () => {
    const records = [
      { clarity: 70, delivery: 0 },
      { clarity: 71, delivery: 0 },
      { clarity: 72, delivery: 0 },
    ];
    const result = dimensionAverages(records, DIMS, 2);
    // latest mean 71.5 -> 72; delta 71.5 - 70 = 1.5 -> 2.
    expect(result.clarity).toEqual({ average: 72, delta: 2 });
  });

  it("treats a nonsense window as empty", () => {
    const result = dimensionAverages([{ clarity: 70, delivery: 70 }], DIMS, 0);
    expect(result.clarity).toEqual({ average: null, delta: null });
  });
});
