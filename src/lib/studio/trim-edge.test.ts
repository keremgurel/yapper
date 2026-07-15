import { describe, expect, it } from "vitest";
import { MIN_TRIM, trimStartEdge, trimEndEdge } from "@/lib/studio/trim-edge";

const orig = { start: 5, duration: 10, sourceStart: 3 };

describe("trimStartEdge", () => {
  it("moves start and in-point together, keeping the right edge fixed", () => {
    const r = trimStartEdge(orig, 2, { min: 0, isImage: false });
    expect(r.start).toBe(7);
    expect(r.duration).toBe(8);
    expect(r.sourceStart).toBe(5);
    // Right edge (start + duration) is unchanged.
    expect(r.start + r.duration).toBe(orig.start + orig.duration);
  });

  it("will not shrink the clip below MIN_TRIM", () => {
    const r = trimStartEdge(orig, 100, { min: 0, isImage: false });
    expect(r.duration).toBeCloseTo(MIN_TRIM, 10);
  });

  it("will not pull the in-point before the media start", () => {
    // Dragging left by more than sourceStart would give a negative in-point.
    const r = trimStartEdge(orig, -10, { min: 0, isImage: false });
    expect(r.sourceStart).toBe(0);
    // start moved left by exactly sourceStart (3), from 5 to 2.
    expect(r.start).toBe(2);
  });

  it("will not cross the timeline min (a neighbour or 0:00)", () => {
    const r = trimStartEdge(orig, -10, { min: 4, isImage: false });
    expect(r.start).toBe(4);
  });

  it("keeps an image's in-point fixed (no media to run out of)", () => {
    const r = trimStartEdge(orig, -10, { min: 0, isImage: true });
    expect(r.sourceStart).toBe(3);
  });
});

describe("trimEndEdge", () => {
  it("changes only the duration", () => {
    const r = trimEndEdge(orig, 2, { max: Infinity, fullDuration: Infinity });
    expect(r.start).toBe(5);
    expect(r.sourceStart).toBe(3);
    expect(r.duration).toBe(12);
  });

  it("will not shrink the clip below MIN_TRIM", () => {
    const r = trimEndEdge(orig, -100, {
      max: Infinity,
      fullDuration: Infinity,
    });
    expect(r.duration).toBeCloseTo(MIN_TRIM, 10);
  });

  it("will not ask for more media than the source has", () => {
    // sourceStart 3 + duration 10 = 13 already used; media is 15 long, so the
    // out-point can extend by at most 2.
    const r = trimEndEdge(orig, 100, { max: Infinity, fullDuration: 15 });
    expect(r.duration).toBe(12);
  });

  it("will not run past a neighbour on the timeline", () => {
    // start 5 + duration 10 = 15; neighbour at 16 allows only +1.
    const r = trimEndEdge(orig, 100, { max: 16, fullDuration: Infinity });
    expect(r.duration).toBe(11);
  });
});
