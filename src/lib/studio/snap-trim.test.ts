import { describe, expect, it } from "vitest";
import { snappedTrimDelta } from "@/lib/studio/snap-trim";

// A clip at timeline [2, 7] (start 2, duration 5). Points: a neighbour edge at
// 3, the playhead at 6.
const START = 2;
const DUR = 5;
const POINTS = [3, 6];

describe("snappedTrimDelta", () => {
  it("pulls the left edge onto a nearby magnet", () => {
    // Left edge dragged to 2.9 (delta 0.9); 3 is within 0.2, so it lands on 3
    // (delta becomes 1).
    expect(snappedTrimDelta("start", START, DUR, 0.9, POINTS, 0.2)).toBeCloseTo(
      1,
      5,
    );
  });

  it("pulls the right edge onto a nearby magnet", () => {
    // Right edge starts at 7; dragged to 6.1 (delta -0.9). 6 is within 0.2, so
    // it lands on 6 (delta -1).
    expect(snappedTrimDelta("end", START, DUR, -0.9, POINTS, 0.2)).toBeCloseTo(
      -1,
      5,
    );
  });

  it("leaves the delta unchanged when no magnet is in range", () => {
    // Left edge at 2.5 (delta 0.5): nearest point 3 is 0.5 away, past the 0.2
    // threshold, so no snap.
    expect(snappedTrimDelta("start", START, DUR, 0.5, POINTS, 0.2)).toBe(0.5);
  });

  it("snaps each edge to its own nearest point, not the other edge's", () => {
    // The right edge (at 7 + delta) must consider 6, not 3.
    expect(snappedTrimDelta("end", START, DUR, -1.05, POINTS, 0.2)).toBeCloseTo(
      -1,
      5,
    );
  });
});
